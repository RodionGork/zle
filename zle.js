// ZLE (Zany Language for Enthusiasts) - small JS interpreter

var zle = {
	code: [],
	sourceLineNums: [],
	labels: [],
	vars: [],
	relops: ['o=', 'o>', 'o<', 'o>=', 'o<=', 'o<>', 'o!=', 'o=='],
	bops: [],
}

zle.cleanup = function() {
    zle.code = [];
    zle.sourceLineNums = [];
    zle.labels = [];
}

zle.parseLines = function(lines) {
    zle.cleanup();
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        try {
            let tokens = zle.tokenize(line);
            let label = zle.stripLabel(tokens);
            if (label) zle.labels[label] = zle.code.length;
            let out = [];
            while (tokens.length) {
                let stmt = zle.takeStatement(tokens);
                if (stmt.length) {
                    stmt[0] = zle.tokenBody(stmt[0]);
                    zle.sourceLineNums[zle.code.length] = i+1;
                    zle.code.push(stmt);
                }
                if (tokens.length) {
                    let delim = tokens.shift();
                    zle.expectToken(delim, 'p;', 'Extra tokens at the end of statement');
                }
            }
        } catch (err) {
            alert('Line #' + (i+1) + ":" + err.message);
        }
    }
}

zle.tokenize = function(line) {
    let initialLen = line.length;
    let res = [];
    while (1) {
        line = line.replace(/^\s+/, '');
        if (!line.length || line[0] == '#') break;
        let type = 'e';
        let m = [];
        if (zle.strmatch(/^[a-z_][a-z_0-9\.]*/i, line, m)) {
            type = 'w';
            m[0] = m[0].toUpperCase();
        } else if (zle.strmatch(/^(?:[0-9]*\.)?[0-9]+(?:e[\+\-]?[0-9]+)?/i, line, m)) {
            type = 'n';
        } else if (zle.strmatch(/^(?:>=|<=|<>|!=|>|<|==|=|\+|-|\*|\/|%|\\|\^|&|\|)/, line, m)) {
            type = 'o';
        } else if (zle.strmatch(/^[,;:\(\)\[\]]/, line, m)) {
            type = 'p';
        } else if (line[0] == '"' || line[0] == '\'') { //to be improved for escapes
            let p = line.indexOf(line[0], 1);
            if (p == -1) {
                m[0] = 'Unclosed string literal';
            } else {
                type = 'q';
                m[0] = line.substring(0, p+1);
            }
        } else {
            m[0] = 'Unrecognized character at position ' + (initialLen - line.length + 1);
        }
        line = line.substring(m[0].length);
        if (type == 'q') m[0] = m[0].slice(1, -1);
        res.push(type + m[0]);
        if (type == 'e') break;
    }
    return res;
}

zle.takeStatement = function(tokens) {
    let cmd = tokens[0];
    zle.expectTokenType(cmd, 'w', 'Command or Variable expected');
    cmd = zle.tokenBody(cmd);
    switch (cmd) {
        case 'GOTO':
            return zle.takeGo(tokens);
        case 'EXEC':
            return zle.takeExec(tokens);
        case 'PUSH':
        case 'POP':
            return zle.takePushPop(tokens);
        case 'END':
            return [tokens.shift()];
        case 'LET':
            tokens.shift();
        default:
            return zle.takeAssign(tokens);
    }
}

zle.takeExec = function(tokens) {
    let res = [tokens.shift()];
    let nextExpr = true;
    let delim = '';
    while (tokens.length && tokens[0] != 'p;') {
        if (nextExpr) {
            res.push(zle.takeExpr(tokens));
        } else {
            delim = tokens.shift();
            zle.expectToken(delim, 'p,', 'End of statement or comma expected in EXEC');
        }
        nextExpr = !nextExpr;
    }
    return res;
}

zle.takeGo = function(tokens) {
    let res = [tokens.shift()];
    if (!tokens.length) zle.throwLineError(zle.tokenBody(res[0]) + ' without label');
    res.push(zle.takeExpr(tokens));
    return res;
}

zle.takeAssign = function(tokens) {
    if (tokens.length < 3) zle.throwLineError('Unexpected end of statement');
    let v = zle.takeLvalue(tokens);
    zle.expectToken(tokens, 'o=', 'Assignment operator expected');
    tokens.shift();
    return ['wLET', zle.takeExpr(tokens), v];
}

zle.takePushPop = function(tokens) {
    let op = tokens.shift();
    let res = [op, (op == 'wPOP') ? zle.takeLvalue(tokens) : zle.takeExpr(tokens)];
    if (tokens.length && tokens[0] == 'p,') {
        tokens.shift();
        res.push(zle.takeExpr(tokens));
    }
    return res;
}

zle.takeLvalue = function(tokens) {
    let v = zle.takeVariable(tokens);
    let res = [v.pop()];
    if (v.length) res.push(v);
    return res;
}

zle.takeVariable = function(tokens) {
    zle.expectTokenType(tokens[0], 'w', 'Variable expected');
    let name = tokens.shift();
    let pureName = zle.tokenBody(name);
    if (!tokens.length || tokens[0] != 'p[') return ['v' + pureName];
    tokens.shift();
    name = 'a' + pureName;
    let expr = zle.takeExpr(tokens);
    if (!tokens.length || tokens[0] != 'p]') zle.throwLineError('Expected "]" after array index');
    tokens.shift();
    expr.push(name);
    return expr;
}

zle.takeBinaryFn = function(subfn, ops) {
    return function(tokens) {
        let res = subfn(tokens);
        while (tokens.length && ops.indexOf(tokens[0]) >= 0) {
            let op = tokens.shift();
            res.push(...subfn(tokens));
            res.push(op);
        }
        return res;
    }
}

zle.takeExprVal = function(tokens) {
    if (!tokens.length) zle.throwLineError('Expression expected');
    switch (tokens[0][0]) {
        case 'n':
        case 'q':
            return [tokens.shift()];
        case 'w':
            return zle.takeVariable(tokens);
        default:
            if (tokens[0] == 'p(') {
                return zle.takeSubExpr(tokens);
            } else if (tokens[0] == 'o-') {
                return zle.takeNegVal(tokens);
            } else {
                zle.throwLineError('Broken expression syntax');
            }
    }
}

zle.takeSubExpr = function(tokens) {
    tokens.shift();
    let expr = zle.takeExpr(tokens);
    if (!tokens.length || tokens[0] != 'p)') zle.throwLineError('Missing closing parenthesis ")"');
    tokens.shift();
    return expr;
}

zle.takeNegVal = function(tokens) {
    tokens.shift();
    if (tokens && tokens[0] == 'o-') zle.throwLineError('Unexpected extra minus sign');
    let res = ['n0'];
    res.push(...zle.takeExprVal(tokens));
    res.push('o-');
    return res;
}

zle.takeExprPwr = zle.takeBinaryFn(zle.takeExprVal, ['o^']);
zle.takeExprMul = zle.takeBinaryFn(zle.takeExprPwr, ['o*', 'o/', 'o%', 'o\\']);
zle.takeExprSum = zle.takeBinaryFn(zle.takeExprMul, ['o+', 'o-']);
zle.takeExprCmp = zle.takeBinaryFn(zle.takeExprSum, zle.relops);
zle.takeExprAnd = zle.takeBinaryFn(zle.takeExprCmp, ['o&']);
zle.takeExpr = zle.takeBinaryFn(zle.takeExprAnd, ['o|']);

zle.strmatch = function(re, s, m) {
    let res = s.match(re);
    if (res === null) return false;
    while (res.length) m.push(res.shift());
    return true;
}

zle.stripLabel = function(tokens) {
    if (!tokens.length) return null;
    let tkn0 = tokens[0];
    let type0 = tkn0[0];
    if (type0 == 'w' && tokens.length > 1 && tokens[1] == 'p:') {
        tokens.shift();
    } else if (type0 != 'n') {
        return null;
    }
    tokens.shift();
    return zle.tokenBody(tkn0);
}

zle.tokenBody = (token) => token.substring(1);

zle.expectToken = function(token, expected, errmsg) {
    if (Array.isArray(token))
        token = token.length ? token[0] : '';
    if (!Array.isArray(expected)) {
        if (token == expected) return;
    } else {
        for (let i = 0; i < expected.length; i++)
            if (token == expected[i]) return;
    }
    zle.expectTokenFailed(token, errmsg);
}

zle.expectTokenType = function(token, expected, errmsg) {
    if (Array.isArray(token))
        token = token.length ? token[0] : '?';
    if (expected.indexOf(token[0]) < 0)
        zle.expectTokenFailed(token, errmsg);
}

zle.expectTokenFailed = function(token, errmsg) {
    if (token[0] == 'e') errmsg = zle.tokenBody(token);
    zle.throwLineError(errmsg);
}

zle.throwLineError = function(msg) {
    throw new Error(msg);
} 

zle.executeCode = function() {
    let lineNum = -1;
    zle.vars = [];
    zle.vars.PC = 0
    zle.vars.SP = 0
    try {
        while (zle.vars.PC < zle.code.length) {
            lineNum = zle.sourceLineNums[zle.vars.PC];
            let stmt = zle.code[zle.vars.PC++];
            switch (stmt[0]) {
                case 'LET': zle.execAssign(stmt); break;
                case 'GOTO': zle.execGoto(stmt); break;
                case 'EXEC': zle.execExec(stmt); break;
                case 'PUSH': zle.execPush(stmt); break;
                case 'POP': zle.execPop(stmt); break;
                case 'END': zle.vars.PC = zle.code.length; break;
                default: zle.throwLineError('Command not implemented: ' + stmt[0]);
            }
        }
    } catch (err) {
        return 'Runtime error (line #' + lineNum + '): ' + err.message;
    }
    return null;
}

zle.execAssign = function(stmt) {
    let v = zle.evalExpr(stmt[1]);
    zle.setVariable(stmt[2], v);
}

zle.execGoto = function(stmt) {
    let target = undefined;
    if (stmt[1].length == 1 && stmt[1][0][0] == 'v') {
        target = zle.labels[zle.tokenBody(stmt[1][0])];
    }
    if (target === undefined) {
        label = zle.evalExpr(stmt[1]);
        if (typeof(label) == 'string') label = label.toUpperCase();
        target = zle.labels[label];
    }
    if (target !== undefined) zle.vars.PC = target;
}

zle.execExec = function(stmt) {
    let name = zle.evalExpr(stmt[1]).split('.');
    let args = [];
    for (let i = 2; i < stmt.length; i++)
        args.push(zle.evalExpr(stmt[i]));
    let f = window;
    while (name.length) f = f[name.shift()];
    zle.vars['_'] = f(...args);
}

zle.execPush = function(stmt) {
    let v = zle.evalExpr(stmt[1]);
    zle.stackAccess(stmt, v);
}

zle.execPop = function(stmt) {
    zle.setVariable(stmt[1], zle.stackAccess(stmt));
}

zle.stackAccess = function(stmt, v) {
    let name = 'STACK';
    let sp = 'SP';
    if (stmt.length > 2) {
        name = zle.evalExpr(stmt[2]).toUpperCase();
        sp += '!' + name;
    }
    name += '!';
    let spv = zle.vars[sp];
    if (spv === undefined) spv = 0;
    let old = zle.vars[name + (spv--)];
    if (v !== undefined) zle.vars[name + (spv+=2)] = v;
    zle.vars[sp] = spv;
    return old;
}

zle.evalExpr = function(expr) {
    let stk = [];
    for (let i = 0; i < expr.length; i++) {
        let v = expr[i];
        let body = zle.tokenBody(v);
        if (v[0] == 'n') {
            stk.push(parseFloat(body));
        } else if (v[0] == 'q') {
            stk.push(body);
        } else if (v[0] == 'v') {
            stk.push(zle.getVariable(body));
        } else if (v[0] == 'o') {
            let v2 = stk.pop();
            let v1 = stk.pop();
            stk.push(zle.bops[body](v1, v2));
        } else if (v[0] == 'a') {
            stk.push(zle.getVariable(zle.tokenBody(v) + '!' + stk.pop()));
        }
    }
    return stk[0];
}

zle.setVariable = function(expr, value) {
    let name = zle.tokenBody(expr[0]);
    if (expr.length > 1) {
        let idx = zle.evalExpr(expr[1]);
        name += '!' + idx;
    }
    zle.vars[name] = value;
}

zle.getVariable = function(name) {
    let value = zle.vars[name];
    if (value === undefined) zle.throwLineError('Variable not defined: ' + name);
    return value;
}

zle.bops['+'] = (a, b) => a+b;
zle.bops['-'] = (a, b) => a-b;
zle.bops['*'] = (a, b) => a*b;
zle.bops['/'] = (a, b) => a/b;
zle.bops['%'] = (a, b) => a%b;
zle.bops['\\'] = (a, b) => Math.floor(a/b);
zle.bops['^'] = (a, b) => Math.pow(a, b);
zle.bops['<'] = (a, b) => (a<b) ? 1 : 0;
zle.bops['>'] = (a, b) => (a>b) ? 1 : 0;
zle.bops['<='] = (a, b) => (a<=b) ? 1 : 0;
zle.bops['>='] = (a, b) => (a>=b) ? 1 : 0;
zle.bops['<>'] = (a, b) => (a!=b) ? 1 : 0;
zle.bops['!='] = zle.bops['<>'];
zle.bops['='] = (a, b) => (a==b) ? 1 : 0;
zle.bops['=='] = zle.bops['='];
zle.bops['&'] = (a, b) => a ? b : 0;
zle.bops['|'] = (a, b) => a ? a : b;
