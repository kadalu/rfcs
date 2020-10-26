---
layout: docs
---
- Start Date: 2020-08-19
- Tracking: (leave this empty)
- RFC PR: [kadalu/rfcs#19](https://github.com/kadalu/rfcs/pull/19)

# Optimized lazy Quota at subdirectory level

## Summary

GlusterFS's quota implementation is having major performance issues. It is
expressed by many users. When we proposed to drop quota feature from fs, many
users requested for this feature, even though it has perf issues, because it
solves some genuine problems for them, and is a required feature for their
deployments.

We need quota in our kadalu deployments too, and for now we are using xfs quota
support.

## Motivation

A good quota implementation in glusterfs itself, would allow more adoption
of gluster project, and also it benefits kadalu deployments immensely, by
allowing a true distributed replicate volume to be present.

Just by looking at top level, there seems to be many possibilities, if we allow
some limitations to creep in. That is, lets not do a quota which would solve
every possible usecase, but solves few usecases very efficiently.


## Detailed design

At very top level, the current proposal tries to make only minimal changes to
current quota design, and hence expect it to work smoothly with the deployments.
This RFC doesn't mandate any implementation guidelines on management layer,
considering kadalu's vision of better management tool with
[moana project](https://github.com/kadalu/moana).

With this new proposal, I believe the performance can be optimized to
a large extent. To let you know the impact, current day quota has almost
250% hit from regular deployments, where as the new one would have anywhere
between 5-10% hit. And code changes would also be minimal.


So, the toplevel change includes below:

* Instead of current filelevel xattrop update of consumption, all the
  consumptions would be tracked at the namespace (or quota dir) level.
* namespaces would be implemented at the 'server-resolve' level, so
  every inode would know which namespace it belongs to.
* Getting and setting quota exhaust information can happen just through
  statfs() and setxattr() respectively, instead of new service, RPC etc!


Well, that looks very minimal changes at the conceptual level. Lets look into
what the implementation would be like.


#### Introduction of 'namespace' or 'project' inside of the volume.

We had gotten introduced to some concept of a namespace earlier from facebook team, this is similar, but my proposal is to introduce it at the inode scope (ie, for entire process) instead of a translator level. The idea is, every inode should have an information of which namespace it belongs to.

It can be achieved by having it at 'resolve' level. In glusterfs, while operations are possible with just a single gfid, filesystem with fuse mount itself would send 'lookup()' on all parent path in most of the case, so the top down path resolution would happen in 'resolve'.

We will start with root ('/') inode as the namespace for entire filesystem. for all other paths, while 'resolve' modules does 'lookup()', we can send few keys which mandates for a separate namespace (like quota limit, etc). If the lookup returns these keys, then we can create a new namspace for the inode. If not, the inode will inherit the parent inode's namespace. At present it is assumed that, the namespace pointer will be inode itself of the namespace.

This way, during resolve itself the namespace information is built in. Getting this work complete is very critical for the proposal to realize.

This also needs a minor update to the way server-resolve happens today. We would need complete path to be resolved when a gfid based lookup is done for the first time. Which also means, memory consumption on server side would increase by a bit! (ie, all namespace inodes would be in cache without lru limit impacting them).


#### Changes in 'marker-quota'

This module wouldn't be required, and the marker-quota feature can be merged to Quota itself.


#### Changes in Quota

This module would see some changes

* Implement the 'marker-quota' feature in here (just to update the namespace)
* Remove quotad RPC code
* The global consumption info can be just in memory! (Even if the process restarts, the service which should update global info should update the process as soon as it connects.
* Make sure df (ie, statfs()) is properly implemented.

#### New quota update service!

Just run `statfs()` on all dirs which has Quota set, and send a flag to update status of quota xlator through internal xattr mechanism if quota limit exceeds for a directory! This can run once in 5 or 10 seconds, or even lesser frequency if the quota limit is huge!

* In future the frequency can also be dependent on how much of limit is left, say if just 1GB is pending, then update can happen every 2-5 seconds, but if the limit is 1TB, then update can happen once a minute or even slower!


#### Management layer changes

* Considering the namespace resolution needs to be handled at brick side, when a quota limit is set, every brick (or brick process) should have the limit information sent.
  - This can be done by xattr, so brick gets it, and also is preserved!

* Advised method is adding quota limit info before writing any information to directory. Even otherwise we don't need quota crawl for updating quota-limit, but do a `du -s -b $dir` and write the output into xattr.

* No need to write dir info to volfile, which means no graph switch problems.


#### Changes to DHT statfs

* If Quota is set (or not), implement a mechanism to send 'almost realistic' information when one of the subvol is completely down!

For example, if there are 5 subvols, and each with 10TB storage bricks...

Now assume one node is down, and out of other 4 nodes, we got statfs as 23TB / 40TB consumed. Now, do the math, add ~60% of consumption from the node which was down! that way, instead of showing less size for the whole filesystem, the system reports, ~30TB / 50TB, which in **most** of the cases can be right! And also we can put disclaimer in log that this is done to make sure we provide better information to users!

And if quota set (ie, deem-statfs), then total remains same, but the consumption increases! even here, the same above rule should apply!

