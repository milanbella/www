If you running cordova based mobile app you cannot use shared workers beacuse
application is source from localhost as oposed to public DNS hostname.
Thererefore the only option is to use dedicated workers, however in this case
you cannot spwan multiple instances of same worker neither workers cannot
communicate between each See:
https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers.

This is the working in production example on how using dedicated worker inter
worker communication may be achieved. Dedicated worker is booted by main thread
by bootWorker() call in src/app/services/worker.ts. Main thread assigns to
worker unique id which must be acknowledged back to main thread by worker
instance. Hence both main thread and worker share same id identifying worker
instance.  Main thread keeps track of all workers ids, ids are then used for
dipatching the messages between worker instances. 

The simple concept described above allowed us for proxying webSQL interface from
main thread to dedicated worker thread in src/workers/websqlw.ts. Therefore we
were able to moved amazon SQS SQL to webSQL backend database continuous
replication from main thread to webworker.  This improved main thread UI
performance as database replication is running now in worker ( see
src/workers/websqlw.ts,  src/workers/sqsWorker.ts).  Wokers instances are
communicatiog to logging worker sending loging messages to backend proccess (
see workers/loggingWorker.ts).


The disadwatage is that all messages between dedicated worker instances must
be proxied via main thread, but never the less we observed significant
perfomence main thread UI boost moving background continuos processes from main
thread to dedicated worker.  
