- Start Date: 2019-11-30
- Tracking: 
- RFC PR: [kadalu/rfcs#2](https://github.com/kadalu/rfcs/pull/2)

# Supporting External Gluster Cluster with Kadalu

## Authors

* Aravinda VK - aravinda@kadalu.io
* Amar Tumballi - amar@kadalu.io

## Summary

Kadalu Operator accepts the raw devices provided from each node and creates Gluster volume using those devices. These Gluster Volumes will be used to provision persistent volumes claimed by Kubernetes applications. The Kadalu Operator itself manages Gluster volumes. In this use-case, the user already has managed Gluster cluster, and Kadalu Operator and CSI drivers use the external Gluster Cluster and provision persistent volumes for Kubernetes applications.

## Motivation

This feature is critical for success of kadalu, as there are many users and administrators who would like to keep storage out of their application management. This way, they can isolate the responsibility and management. We have been asked about such feature in early stages of the project, and many users said that without this feature, they wouldn't use the project.

## Detailed design

The need is further discussed in : https://github.com/kadalu/kadalu/issues/36

### Connect to remote Glusterd from CSI pods
Accept the storage configuration with just Volume name and list of primary node and backup nodes, as mentioned in the Github issue.

```yaml
# File: storage-config.yaml
---
apiVersion: kadalu-operator.storage/v1alpha1
kind: KadaluStorage
metadata:
  # This will be used as name of PV Hosting Volume
  name: ext-storage
spec:
  type: External #Here, volume type can be anything
  details:
    - gluster_node: node1
      gluster_volname: volume_name # Volume name
      Gluster_options: log_level=DEBUG
```

Deploy this storage configuration using,

```console
kubectl create -f storage-config.yaml
```
Instead of generating Volfile based on Volume info stored in configMap, Gluster clients running in CSI pods directly connect to remote Glusterd and gets Client Volfile.

Now, while requesting PV from this storage, use ‘StorageClass’ as `kadalu.external.{{ config_name }}`, in this case **`kadalu.external.ext-storage`**.

### Quota
Kadalu provides persistent storage by creating a sub-directory and by setting subdirectory quota(Kadalu uses backend filesystem Quota). Run Kadalu Quota daemon in each Gluster node, which contains brick(s) of exported volume.

Add exported volumes list to `/var/lib/glusterd/kadalustorage.info` and start/restart the kadalu quota daemon.
(TBD: If we can set some metadata to Volumes then no need of external configuration, the daemon can get the list of exported volumes from Volume info).

```
systemctl start kadalu-quotad
```

For each exported volume, Quota daemon gets local bricks list and crawls each brick and sets Quota when necessary.


### Challenges
* We may not have execution permission on Gluster Cluster, and hence, all ‘side-car’ container tasks we are planning to do would need to be run by the admin on gluster cluster.
  - Quota
  - Monitoring
  - Backup

* The volume may have features we don’t support
* The volume may have distribute, in which case, some assumptions we have made would go wrong.
* The bricks may not be using xfs.
* Gluster version in CSI pods may be different from than version of the external Gluster cluster. A possible solution is to release CSI container images with different Gluster versions.
* If Volume options or sub-volume changes in the externally managed cluster, will Glusterfs client running in CSI pods gets the notification?
* CSI pods should have access to nodes of Gluster cluster, That means CSI pods can connect to any Gluster nodes(Port 24007 and brick ports)


### Assumptions
With the above Challenges, to deliver a feature, it is good for us to go with some assumptions, and guidelines.

* Only xfs bricks are supported now, Quota works only if the externally managed Gluster Volume contains bricks with xfs filesystem and projectquota is enabled on these brick mounts.
* Only glusterfs version 6 or higher to be used on gluster-cluster (ie, RHGS 3.5 and above if one is using RHGS).
* Only Single brick volume, or Replicate/Disperse/Arbiter volume supported. Ie, if distribute is used, the volume size limit for PV users wouldn’t be valid, hence not supported.
* Python3 support is expected on the Brick host machine.



### Improvements

Considering even heketi created volumes can become an external entity for same ‘External’ type, proposing 1 more fields in the config 'KadaluStorage'.

```
‘kadalu-format’ : true/false
```

This option will tell CSI driver, how the data / PV layout is. If it is a subdirectory based (ie, kadalu model), or heketi model, which means, the whole volume is a single PV.



### Implementation

The initial work towards this has been done in below PRs.

* https://github.com/kadalu/kadalu/pull/88
* https://github.com/kadalu/kadalu/pull/81



