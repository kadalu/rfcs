- Start Date: 2020-01-24
- Tracking:
- RFC PR: [kadalu/rfcs#12](https://github.com/kadalu/rfcs/pull/12)

# Error codes in Gluster

## Versions

v0.1 -  24th  Jan, 2020.

### Contributors

Amar Tumballi <amar@kadalu.io> [@amarts](https://github.com/amarts)
Xavi Hernandez <jahernan@redhat.com> [@xhernandez](https://github.com/xhernandez)

### Special thanks

Jeff Darcy <jeff@pl.atyp.us> - [@jdarcy](https://github.com/jdarcy)


### Reference

https://github.com/gluster/glusterfs/issues/280


## Introduction

The above github issue talks about the need for error-codes in glusterfs, and even goes to the details of how we can achieve it. This document is an attempt to consolidate all those points and come at something meaningful before we implement it for real.

The need for this is very simple, and critical too. At any point of execution, if there is a failure, we should be having exact reason for failure, instead of making guesses. This also allows us to reduce the logs, and debugging effort in case of problems. If a product is easy to debug, then it means, it is easy to maintain, and improve.


### Challenges

* The first and foremost problem is, the amount of changes we need to do to complete the effort. 
* Changes shouldn't be very disruptive, and should be easier to review.
* This should be done without disturbing the current code flow, so we can break it into multiple smaller patches, without breaking regression.
* Need contribution across codebase, so more of collaborated activity.


### Points from github issue

* We only have 32 bits to use, so breaking it into multiple groups of fewer bits would be useful.
* Originator ID (to identify which xlator) caused the issue is very helpful.
* The errorcodes should be negative to indicate error, so, 0 can be reserved for success, and +ve is for other overloaded success values.
* Instead of static id, good to get originator-id (or xlator id) in run time.


## Proposed solution

* Use return value to indicate error code, let errno continue to exist till we make complete changes.
  - This is easier to make change in codebase, as `(ret < 0)` is considered failure already.
  - This doesn't impact the checks we have to compare errno and then decide what to do. Keeping it the same would make regressions run smoothly and also would help in quicker reviews.
* Reserve 8k worth (13bits) of error-codes per translator.
  - Allows 17 more bits for originator-id and other things.
* Provide a thread local pointer in `gf_strerror()`, so one can use it similar to `strerror()`. Also provide an alternative to return filled pointer like `uuid_utoa_r()`.
  - The thread local pointer would be used in most places where it is just used in logging.
  - The alternative method would be used if one needs to store the pointer, or use it more than one time.
* Make sure to check the complete execution path to treat negative value as error, not just -1.
  - This should be done more carefully.
* Let each translator have their static ID through enum.
  - In the initial version it wouldn't be runtime, and not per instance of xlator.



### Future improvements

Design a way to get details of translators running on server-side, and their run-time-id, during client-handshake. That way, we can pin-point the issue to a particular instance of translator in future, instead of the static id. This will be useful for translators designed and written outside of glusterfs too.

