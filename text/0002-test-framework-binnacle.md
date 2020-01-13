- Start Date: 2020-01-07
- Tracking:
- RFC PR: [kadalu/rfcs#6](https://github.com/kadalu/rfcs/pull/6)

# Test Framework - Binnacle

## Authors

- Aravinda Vishwanathapura <aravinda@kadalu.io>

## License

Binnacle is licensed under the [Apache 2.0
license](https://www.apache.org/licenses/LICENSE-2.0)

## Introduction

Proposal for a Test framework with the focus for Tester's delight!

Automating tests in a distributed setup is always hard. Binnacle aims
to simplify the ergonomics so that a tester without Programming
language expertise can adapt to this quickly.

If someone knows which command to test, then write that command with
the prefix `TEST`. For example, the command `touch
/var/www/html/index.html` tries to create a file inside the directory
to see if it succeeds. To convert this into a test case, write as
below.

```
# File: hello.t
TEST touch /var/www/html/index.html
```

That's it! Run the test file using the binnacle command, and it gives
the beautiful Output as below.

```console
$ binnacle hello.t
hello.t .. ok
All tests successful.
Files=1, Tests=1,  0 wallclock secs ( 0.03 usr  0.01 sys +  0.07 cusr  0.05 csys =  0.16 CPU)
Result: PASS
```

The verbose(`-v`) Output gives other useful details about executed
command and error lines in case of errors.

Learning the new programming language is not required to write test
cases.

**Note**: This framework is not for Unit testing

## Features

- [Multi node support](#Multi-node-support)
- [Bash style variable substitution](#Bash-style-variable-substitution)
- [Validate Return code](#Validate-Return-code)
- [Validate the return value](#Validate-the-return-value)
- [To check if any expected value from the Output](#To-check-if-any-expected-value-from-the-Output)
- [Timeout for tests](#Timeout-for-tests)
- [Pipelines](#Pipelines)
- [Extending functionalities by writing Python function or Bash function](#Extending-functionalities-by-writing-Python-function-or-Bash-function)
- [Recording Output of a command](#Recording-Output-of-a-command)
- [Loop](#Loop)
- [Ease of use](#Ease-of-use)

### Multi-node support

Just specify `NODE=<nodename>` before any test to run in that
node. For example,

```
NODE=node1.example.com
TEST command1
TEST command2

NODE=node2.example.com
TEST command3
```

**Note**: Passwordless SSH access is required from the current node
for all the nodes which are specified in Tests.

### Bash style variable substitution

```
VOLNAME=gv1
TEST gluster volume start ${VOLNAME}
```


### Validate Return code

`TEST` helper validates the return code of the command, for example,

```
TEST stat /etc/glusterfs/glusterd.vol
```

Above command is equivalent to the following bash script.

```
stat /etc/glusterfs/glusterd.vol
if [ $? -eq 0 ]
then
    echo "SUCCESS"
else
    echo "FAIL"
fi
```

To test other return code use `--ret=<return-code>`. For example,

```
TEST --ret=1 stat /non/existing/file
```

To test the return code is not some value. For example,

```
TEST --not=0 stat /non/existing/file
```

### Validate the return value

To verify the Output of commands, `EXPECT` can be used.

```
EXPECT -v 10 wc -l /test/output
```

### To check if any expected value from the Output

```
EXISTS "127.0.0.1 node1.example.com" cat /etc/hosts
```

### Timeout for tests

All the utilities discussed above have a variant with `_WITHIN`
suffix. For example,

```
TEST_WITHIN -t 60 stat /path/to/pid/file
EXPECT_WITHIN -t 10 wc -l /test/output
```

### Pipelines

Pass Output of one command to other function using `|`. For example,

```
TEST cat /etc/hosts | grep "node1.example.com"
```

### Extending functionalities by writing Python function or Bash function

The name of command after `TEST` or any other utilities can be a
Python function. For example, below command calls Python/bash function
`brick_kill`.

```
NODE=node2.example.com
TEST brick_kill "/exports/bricks/${volname}/brick2/brick"
```

**Note**: Make sure to use the function name different than the actual
command. For example, if a function is created as `gluster` then that
function will get called instead of actual Gluster command.


### Recording Output of a command

Sometimes we can't run the same command multiple times, but Output
needs to be verified multiple times. For example,

```
TEST gluster volume info --record-output /tmp/status.dat
EXPECT -v 2 grep "ID:" /tmp/info.dat | wc -l
EXPECT -v 1 grep "Status:" /tmp/info.dat | grep "Running" | wc -l
```

### Loop

Repeating tests are straightforward to implement, define `LOOP_DATA`
as JSON, and then use indentation to define loop tasks.

```
LOOP_DATA="""
[
    {
        "node": "node1.example.com",
        "device": "/dev/vdc"
    },
    {
        "node": "node2.example.com",
        "device": "/dev/vdc"
    },
    {
        "node": "node3.example.com",
        "device": "/dev/vdc"
    }
]
"""

LOOP:
    NODE=$node
    TEST mkfs.xfs $device
```

In case of external JSON data,

```
LOOP_DATA_FILE=device_config.json
LOOP:
    NODE=$node
    TEST mkfs.xfs $device
```

### Ease of use

No special syntax. The example below is to test the Gluster Volume
force start command.

```
N1=node1.example.com
N2=node2.example.com
N3=node3.example.com
volname=gv1

NODE=$N1
TEST gluster volume create ${volname} \
    $N1:/exports/bricks/${volname}/brick1/brick \
    $N2:/exports/bricks/${volname}/brick2/brick
TEST gluster volume start ${volname}
TEST_WITHIN -t 60 gluster volume status ${volname} | match_num_bricks_online 2

NODE=$N2
TEST brick_kill "/exports/bricks/${volname}/brick2/brick"

NODE=$N1
TEST_WITHIN -t 60 gluster volume status ${volname} | match_num_bricks_online 1
TEST gluster volume start ${volname} force
TEST_WITHIN -t 60 gluster volume status ${volname} | match_num_bricks_online 2
```

### Kadalu Test example

```
MASTER=master.example.com
N1=kube-node1.example.com
N2=kube-node2.example.com
N3=kube-node3.example.com
STORAGE_POOL_NAME=sp1
OPERATOR_YAML=operator.yaml
PVC_NAME=pv1
PVC_FILE_NAME=pv1.yaml
APP_POD_NAME=pod1
APP_POD_FILE=pod1.yaml

NODE=$MASTER
TEST kube_master_setup --record-output tmp/master-details.json

LOOP_DATA="""
[
  {
    "node": "$N1",
    "device": "/dev/vdc"
  },
  {
    "node": "$N2",
    "device": "/dev/vdc"
  },
  {
    "node": "$N3",
    "device": "/dev/vdc"
  }
]
"""
LOOP:
    NODE=$node
    TEST kube_node_setup
    TEST join_kube_master tmp/master-details.json
    TEST loop_device_setup $device

NODE=$MASTER
TEST kubectl create -f $OPERATOR_YAML
EXPECT_WITHIN -t 180 -v 3 kubectl get pods -n kadalu | grep "Running" | wc -l
TEST kubectl kadalu storage-add $STORAGE_POOL_NAME --type Replica3 \
    --device $N1:/dev/vdc
    --device $N2:/dev/vdc
    --device $N3:/dev/vdc
EXPECT_WITHIN -t 180 -v 3 kubectl get pods -n kadalu | grep $STORAGE_POOL_NAME | wc -l

# Sample PVC Test
TEST kubectl create -f $PVC_FILE
EXPECT_WITHIN -t 60 -v 1 kubectl get pvc | grep $PVC_NAME | grep Bound | wc -l

# Sample app Test
TEST kubectl create -f $APP_POD_FILE
EXPECT_WITHIN -t 180 -v 1 kubectl get pods | grep $APP_POD_NAME | grep Running | wc -l

```

## How it works?

Similar to Gluster upstream tests, Binnacle uses [Test Anything
Protocol(TAP)](https://en.wikipedia.org/wiki/Test_Anything_Protocol). This
test framework provides syntax sugar on top of the shell script.

Binnacle generates shell script from the given test file and then
executes the generated script using
[prove](https://metacpan.org/pod/distribution/Test-Harness/bin/prove)
command.

## Core functions

Core functions like `TEST`, `EXPECT`, `EXISTS` etc. will be written
using Python and bash. These functions print the Output in TAP format
so that prove tool can understand it.

## Binnacle test to Shell script conversion

A few special syntaxes used are not valid bash script. Those need to
be converted. For example, Pipe character needs to be escaped
otherwise, `TEST` only runs the first part, and all other commands
will be run based on the TEST output instead of the first command’s
Output.

Similarly, the utility file needs to be included in every test file to
understand `TEST`, `EXPECT`, and other functions.

Loop syntax used in the test file needs to be expanded into a valid
bash script.

## How is this different from Gluster upstream Tests

We are inspired by the Gluster upstream regression tests, which use shell
scripts for writing test cases. Binnacle provides an additional layer
on top of shell scripts for ease of use. In addition to ease of use,
Binnacle also offers the following features compared to the Gluster
tests framework.

- Multi-node support
- Plugin support - Extend/add the functionalities easily using Python/Bash
- Detailed easy to parse Output in verbose mode
- Ease of use

## Code repository

[github/kadalu/binnacle](https://github.com/kadalu/binnacle) will be
the project repository for the Binnacle project. While running, it
looks for plugins in `~/.local/lib/binnacle/plugins` directory.

Binnacle repository will not contain Test cases and plugins specific
to different projects.

## Known issues

- The test framework will not work on the Windows operating
  system. Windows support can be adopted in the future but not a
  priority for now.

## Implementation

Not yet started.

## Thanks
- Thanks [Sac](https://github.com/sac), for suggesting the beautiful
  name for the test framework and valuable inputs for the design.
- Thanks [Amar](https://github.com/amarts), for the valuable inputs to
  the design of this framework with more emphasis on ease of use.
