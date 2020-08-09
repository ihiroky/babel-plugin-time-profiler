# babel-plugin-time-profiler

Add profiling code into specified files. You can start/stop the profier and show its result in developer console of a web browser.

## Installation

```sh
yarn add --dev babel-plugin-time-profiler
```

## Usage

### Babel configuration
```json
{
  "plugins": [
    ["babel-plugin-time-profiler", {
      "target": ["**/*"],
      "minLinesToTrace": 0,
      "dropPathPrefix": "src/",
      "displayTop": 20
    }]
  ],
  "retainLines": true
}
```

Available options are as follows:

#### target

File name pattern to process this plugin.

#### minLinesToTrace

The minimum number of lines in methods to add profiling code.

#### dropPathPrefix

Prefix of a file path to hide it in the profiling result.

#### displayTop

The number of entries in the profiling result

### Profiling operation

This plugin exposes `__BPTP` object to handle profiling operation. Operate the profiler using the methods in the `__BPTP` described below:

#### start()

Start profiling.

#### stop()

Stop profiling.

#### dump()

Show profiling result. You can change the ranking order by giving the following strings in the argument of this method:

- duration (default)

Sum of the processing time of the method.

- times

The number of calls of the method.

- avg

Average processing time per the method call.

- min

Minimum processing time per the method call.

- max

Maximum processing time per the method call.
