(function (g, p) {g.__BPTP = g.__BPTP || { running: false, table: {}, now: p.performance ? function () {return p.performance.now();} : function () {return Date.now();}, enter: function (file, lineNo, colNo, funcName, line) {return { key: file + '/' + funcName, loc: 'l:' + lineNo + ' c:' + colNo, line: line, enterTime: __BPTP.now() };}, exit: function (bptpObj) {if (!__BPTP.running) {return;}var duration = __BPTP.now() - bptpObj.enterTime;let state = __BPTP.table[bptpObj.key];if (!state) {__BPTP.table[bptpObj.key] = state = { times: 0, duration: 0, min: Number.MAX_SAFE_INTEGER, max: 0 };}state.times++;state.duration += duration;if (duration < state.min) {state.min = duration;}if (duration > state.max) {state.max = duration;}state.loc = bptpObj.loc;state.line = bptpObj.line;}, start: function () {__BPTP.running = true;__BPTP.table = { start: __BPTP.now() };}, stop: function () {__BPTP.table.stop = __BPTP.now();__BPTP.running = false;}, dump: function (orderBy = 'duration') {if (!__BPTP.table.start || !__BPTP.table.stop) {console.error('Profiler is not started or stopped.');return;}var round = function (v) {return Math.round(v * 1000) / 1000;};var result = [];var profilingDuration = round(__BPTP.table.stop - __BPTP.table.start);var wholeDuration = 0;for (var i in __BPTP.table) {if (i === 'start' || i === 'stop') {continue;}var v = __BPTP.table[i];result.push({ key: i, loc: v.loc, line: v.line, times: v.times, duration: round(v.duration), avg: round(v.duration / v.times), min: round(v.min), max: round(v.max) });wholeDuration += v.duration;}if (['duration', 'times', 'avg', 'min', 'max'].indexOf(orderBy) === -1) {console.error('Unexpected orderBy', orderBy);return;}result = result.sort(function (a, b) {return b[orderBy] - a[orderBy];}).slice(0, 20);console.info('Profiler active time:', profilingDuration, 'ms');console.info('User code executing time:', round(wholeDuration), 'ms (' + round(wholeDuration / profilingDuration * 100) + '%)');console.info(' === Top', result.length, 'function calls order by', orderBy, '===');result.forEach(function (v) {var percentage = round(v.duration / wholeDuration * 100);console.info(v.key, v.loc, 'times:', v.times, 'duration:', v.duration, 'ms (' + percentage + '%)', 'min:', v.min, 'ms', 'max:', v.max, 'ms', 'avg:', v.avg, 'ms: ', v.line);});} };})(window, window);const HELLO = 'World';

function test0() {var _bptp = __BPTP.enter("test/test0.js", 3, 0, "test0", "function test0() {");
  console.log('test0');var _ret =
  'aaa';__BPTP.exit(_bptp);return _ret;
}

function test1() {var _bptp2 = __BPTP.enter("test/test0.js", 8, 0, "test1", "function test1() {");
  console.log('test1');
  for (var i = 0; i < 10000; i++) {
  }var _ret2 =
  'bbb';__BPTP.exit(_bptp2);return _ret2;
}

