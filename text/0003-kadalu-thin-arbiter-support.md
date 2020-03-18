- Start Date: 2020-01-24
- Tracking: kadalu#37
- RFC PR: [kadalu/rfcs#13](https://github.com/kadalu/rfcs/pull/13)
- Status: COMPLETED (in kadalu-v0.6.0)

# Thin Arbiter support for Kadalu Storage


## Author(s)

- Amar Tumballi \<amar@kadalu.io\>

### Reference

https://github.com/kadalu/kadalu/issues/37


## Introduction

Thin-Arbiter is a feature of glusterfs, introduced in v7.0 (Nov 2019). This feature provides a better 'high-availability' solution than replica 2 setup. Replica 2 setups are now not recommended in glusterfs, but default supported is Replica 3 or Replica 2 with Arbiter node. 

The challenge with Replica3 is, the cost of adding one more full set of data is high for users (1/3 increase in hardware cost, and 1/3 reduction in write speed). Hence the recommended solution was 'Arbiter' volume type in gluster, which reduced the 'storage cost' involved in 3rd copy, as it doesn't host any data, but still user has to manage 3 set of machines, and even in arbiter case, the latency requirements are high.


So, the thin-arbiter feature is very useful for users who have just 2 data centers with required latency, but not the 3rd. With this feature, all such users can actually have the 3rd tie-breaker node in cloud without latency limitation.

Even for kadalu users, if you have a stretched k8s cluster, which spans across 2 data centers (or 2 availability zones in Cloud), this feature will be useful. This helps by reducing the resources required for high-availability, and also the speed of write (1/2 instead of 1/3).

The design details of thin-arbiter was discussed [here](https://github.com/gluster/glusterfs/issues/352) and [here](https://docs.gluster.org/en/latest/Administrator%20Guide/Thin-Arbiter-Volumes/). In this proposal we will talk about how we can add thin-arbiter volume type to kadalu.


## Design

Kadalu works with predefined volume templates for gluster. We need add thin-arbiter template, and also define a specific storage `Type` for this template. The same can be used for storage-config 'type' too. Already `Replica1` and `Replica3` namespace taken. We can choose 'Replica2' as it is indeed a replica2 setup.

Motive behind picking Replica2 for thin-arbiter is also because kadalu project would hide the complexity of gluster, and for kadalu users, there is no need to know about gluster's storage options.

Proposed config file looks something like below:

```yaml
# File: storage-config.yaml
---
apiVersion: kadalu-operator.storage/v1alpha1
kind: KadaluStorage
metadata:
 # This will be used as name of PV Hosting Volume
  name: storage-pool-name
spec:
  type: Replica2       # Just to highlight your data is just in 2 places.
  storage:
    - node: kube1      # node name as shown in `kubectl get nodes`
      device: /dev/vdc # Device to provide storage to all PVs
    - node: kube2      # node name as shown in `kubectl get nodes`
      device: /dev/vdc # Device to provide storage to all PVs
  tie-breaker: # Optional. If not present, would consider
               # 'tie-breaker.kadalu.io:/mnt' as the option.
    node: tie-breaker.kadalu.io
    path: /mnt/tie-breaker/
```

In the PV spec, one would need to use the option as below:

```yaml
# -*- mode: yaml -*-
---
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: pv1
spec:
  storageClassName: kadalu.replica2
  accessModes:
    - ReadWriteOnce # You can also provide 'ReadWriteMany' here
  resources:
    requests:
      storage: 1Gi
```

The main definition which needs to be properly validated would be of `tie-breaker`. There is no need to provide this option, in which case it takes **'tie-breaker.kadalu.io:/mnt'** as the option. Kadalu would 'host' a tie-breaker node, and allow anyone to have tie-breaker node on the web.

## Further improvement

In the similar lines, we can add support for 'Arbiter' too, as there may be users who would like to have arbiter support in kadalu. Need to have a reserved type for the same (may be 'Arbiter'). But, it doesn't make sense to expose that option much if thin-arbiter works fine for us.
