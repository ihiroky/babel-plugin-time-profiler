const types = require('@babel/types')
const template = require('@babel/template')
const minimatch = require('minimatch')

const BPTP_NS = '__BPTP'
const BPTP_ENTER = 'enter'
const BPTP_EXIT = 'exit'
const BPTP_OBJ = '__bptp'

const dataAllocationAst = template.statements(`
(function(g, p) {
  g.%%BPTP%% = g.%%BPTP%% || {
    running: false,
    table: {},
    now: (p.performance)
      ? function() { return p.performance.now() }
      : function() { return Date.now() },
    enter: function(file, lineNo, colNo, funcName, line) {
      return {
        key: file + '/' + funcName,
        loc: 'l:' + lineNo + ' c:' + colNo,
        line: line,
        enterTime: %%BPTP%%.now()
      }
    },
    exit: function(bptpObj) {
      if (!%%BPTP%%.running) { return }
      var duration = %%BPTP%%.now() - bptpObj.enterTime
      let state = %%BPTP%%.table[bptpObj.key]
      if (!state) {
        %%BPTP%%.table[bptpObj.key] = state = { times: 0, duration: 0, min: Number.MAX_SAFE_INTEGER, max: 0 }
      }
      state.times++
      state.duration += duration
      if (duration < state.min) { state.min = duration }
      if (duration > state.max) { state.max = duration }
      state.loc = bptpObj.loc
      state.line = bptpObj.line
    },
    start: function() {
      %%BPTP%%.running = true
      %%BPTP%%.table = { start: %%BPTP%%.now() }
    },
    stop: function() {
      %%BPTP%%.table.stop = %%BPTP%%.now()
      %%BPTP%%.running = false
    },
    dump: function(orderBy = 'duration') {
      if (!%%BPTP%%.table.start || !%%BPTP%%.table.stop) {
        console.error('Profiler is not started or stopped.')
        return
      }
      var round = function(v) { return Math.round(v * 1000) / 1000 }
      var result = []
      var profilingDuration = round(%%BPTP%%.table.stop - %%BPTP%%.table.start)
      var wholeDuration = 0
      for (var i in %%BPTP%%.table) {
        if (i === 'start' || i === 'stop') { continue }
        var v = %%BPTP%%.table[i]
        result.push({
            key: i,
            loc: v.loc,
            line: v.line,
            times: v.times,
            duration: round(v.duration),
            avg: round(v.duration / v.times),
            min: round(v.min),
            max: round(v.max)
        })
        wholeDuration += v.duration
      }
      if (['duration', 'times', 'avg', 'min', 'max'].indexOf(orderBy) === -1) {
        console.error('Unexpected orderBy', orderBy)
        return
      }
      result = result.sort(function(a, b) { return b[orderBy] - a[orderBy] }).slice(0, 10)
      console.info('Profiler active time:', profilingDuration, 'ms')
      console.info('User code executing time:', round(wholeDuration), 'ms (' + round(wholeDuration / profilingDuration * 100) + '%)')
      console.info(' === Top', result.length, 'function calls order by', orderBy, '===')
      result.forEach(function(v) {
        var percentage = round(v.duration / wholeDuration * 100)
        console.info(v.key, v.loc, 'times:', v.times, 'duration:', v.duration, 'ms (' + percentage +'%)', 'min:', v.min, 'ms', 'max:', v.max, 'ms', 'avg:', v.avg, 'ms: ', v.line)
      })
    }
  }
})(window, window)`)({ BPTP: types.identifier(BPTP_NS)})
// Use `(globalThis || window, (typeof require === 'function' && require('perf_hooks')) || window)` to run on NodeJS

function getFileName(state) {
  const cwd = state.cwd
  const filename = state.filename
  const dropPathPrefix = state.opts.dropPathPrefix || ''
  const relativeName = filename.substring(cwd.length + 1)  // drop with '/'
  return relativeName.substring(0, dropPathPrefix.length)  === dropPathPrefix
    ? relativeName.substring(dropPathPrefix.length)
    : relativeName
}

function createEnterParameters(path, state, name, lines) {
  const start = path.node.loc ? path.node.loc.start : null
  const line = start ? lines[start.line - 1] : '<No line information>'
  return [
    types.stringLiteral(getFileName(state)),
    types.numericLiteral(start ? start.line : -1),
    types.numericLiteral(start ? start.column : -1),
    types.stringLiteral(name),
    types.stringLiteral(line)
  ]
}

function insertEnter(path, state, name, lines) {
  const bptpObj = path.scope.generateUidIdentifier(BPTP_OBJ)
  const declarator = types.variableDeclarator(
    bptpObj,
    types.callExpression(
      types.memberExpression(
        types.identifier(BPTP_NS),
        types.identifier(BPTP_ENTER)
      ),
      createEnterParameters(path, state, name, lines)
    )
  )
  
  path.get('body').unshiftContainer(
    'body',
    types.variableDeclaration('var', [ declarator ])
  )
  return bptpObj
}

function insertExit(path, bptpObj) {
  path.get('body').pushContainer(
    'body',
    types.expressionStatement(
      types.callExpression(
        types.memberExpression(
          types.identifier(BPTP_NS),
          types.identifier(BPTP_EXIT)
        ),
        [
          bptpObj
        ]
      )
    )
  )
}

function insertExitForArrowFunctionOmittingForm(path, state, name, lines) {
  const bptpObj = path.scope.generateUidIdentifier(BPTP_OBJ)
  const declarator = types.variableDeclarator(
    bptpObj,
    types.callExpression(
      types.memberExpression(
        types.identifier(BPTP_NS),
        types.identifier(BPTP_ENTER)
      ),
      createEnterParameters(path, state, name, lines)
    )
  )
  const retIdentifier = types.identifier('ret')
  const blockStatement = types.blockStatement(
    [
      types.variableDeclaration('var', [ declarator ]),
      types.variableDeclaration(
        'var',
        [
          types.variableDeclarator(
            retIdentifier,
            path.get('body').node
          )
        ]
      ),
      types.expressionStatement(
        types.callExpression(
          types.memberExpression(
            types.identifier(BPTP_NS),
            types.identifier(BPTP_EXIT)
          ),
          [
            bptpObj
          ]
        )
      ),
      types.returnStatement(
        retIdentifier
      )
    ]
  )
  path.get('body').replaceWith(blockStatement)
}

function insertExitForReturnStatement(path, bptpObj) {
  const retIdentifier = path.scope.generateUidIdentifier("ret");
  if (path.node.argument !== null) {
    path.insertBefore(
      types.variableDeclaration(
        'var',
        [
          types.variableDeclarator(
            retIdentifier,
            path.node.argument
          )
        ]
      )
    )
    path.insertBefore(
      types.expressionStatement(
        types.callExpression(
          types.memberExpression(
            types.identifier(BPTP_NS),
            types.identifier(BPTP_EXIT)
          ),
          [
            bptpObj
          ]
        )
      )
    )
    path.replaceWith(
      types.returnStatement(
        retIdentifier
      )
    )
  } else {
    path.insertBefore(
      types.expressionStatement(
        types.callExpression(
          types.memberExpression(
            types.identifier(BPTP_NS),
            types.identifier(BPTP_EXIT)
          ),
          [
            bptpObj
          ]
        )
      )
    )
  }
  path.skip()
}

function insertBlockStatement(path) {
  path.replaceWith(
    types.blockStatement([path.node])
  )
}

const returnVisitor = {
  ReturnStatement(path) {
    if (types.isBlockStatement(path.parent)) {
      insertExitForReturnStatement(path, this.bptpObj)
    } else {
      insertBlockStatement(path)
    }
  },
  Function(path) {
    // Avoid to traverse nested function
    path.skip()
  }
}

function insertTrace(path, state, lines) {
  const name =
    path.node.id ? path.node.id.name :
    path.node.key ? path.node.key.name :
    `anonymous_${path.node.loc.start.line}_${path.node.loc.start.column}`
  if (types.isBlockStatement(path.node.body)) {
    const bptpObj = insertEnter(path, state, name, lines)
    path.traverse(returnVisitor, { bptpObj })

    // Insert exit funtion if no return statement in the tail.
    const bodyArray = path.node.body.body
    if (!types.isReturnStatement(bodyArray[bodyArray.length - 1])){
      insertExit(path, bptpObj)
    }
  } else {
    // Traverse arrow function omitting form
    insertExitForArrowFunctionOmittingForm(path, state, name, lines)
  }
}

function isTargetFile(state) {
  const target = state.opts.target
  if (!target) {
    return false
  }

  if (typeof target === 'string') {
    return minimatch(state.filename, state.opts.target)
  } else if (Array.isArray(target)) {
    for (const t of target) {
      if (minimatch(state.filename, t)) {
        return true
      }
    }
    return false
  }
}

function minLinesToTrace(state) {
  const minLinesToTrace = Number(state.opts.minLinesToTrace)
  return minLinesToTrace >= 0 ? minLinesToTrace : 0
}

function hasEnoughLines(path, state) {
  const loc = path.node.loc
  if (!loc) {
    return false
  }
  return (loc.end.line - loc.start.line + 1) >= minLinesToTrace(state)
}

module.exports = function(babel) {
  const lines = []
  return {
    visitor: {
      Program: {
        enter(path, state) {
          if (!isTargetFile(state)) {
            path.stop()
          }
          Array.prototype.push.apply(lines, state.file.code.split(/\r?\n/))
        },
        exit(path) {
          path.get('body')[0].insertBefore(dataAllocationAst[0])
          path.stop()
        }
      },
      Function(path, state) {
        if (!hasEnoughLines(path, state)) {
          return
        }
        insertTrace(path, state, lines)
      }
    }
  }
}