/* Device-only clearing and progress snapshots. No cloud or account deletion here. */
(function(root){
  const owned=k=>/^(theSystem|system[A-Z]|the_system_|workoutStartedAt:|customMissionDone:|weeklyTrainingCredit:|weeklyWorkoutCredit:|competitiveResultsSeen:)/.test(k);
  const progress=k=>/^(systemTrainTogetherProgress|systemMission|systemWorkoutSessions$|systemProgression|systemAwakeningAssessment|systemLegacy|systemIdentity|systemAscension|systemSocialIdentityCard$|systemAlerts|workoutStartedAt:|customMissionDone:|weeklyTrainingCredit:|weeklyWorkoutCredit:|competitiveResultsSeen:)/.test(k);
  function resetSnapshot(source,fresh){
    const next=Object.fromEntries(Object.entries(source).filter(([k])=>!progress(k)));
    next.the_system_workout_tracker_state=JSON.stringify(fresh);
    let build={},onboarding={};
    try{build=JSON.parse(source.systemPlayerBuildV1||'{}')}catch(_){}
    try{onboarding=JSON.parse(source.systemOnboardingV2||'{}')}catch(_){}
    next.systemPlayerBuildV1=JSON.stringify({path:build.path||'Balanced',profile:build.profile||{},stats:{}});
    next.systemOnboardingV2=JSON.stringify({...onboarding,assessmentPending:true});
    // Keep friends, but discard cached identity and stale local challenge baselines.
    if(source.theSystemSocialV1){try{const social=JSON.parse(source.theSystemSocialV1);delete social.identity;social.challenges=[];next.theSystemSocialV1=JSON.stringify(social)}catch(_){delete next.theSystemSocialV1}}
    return next;
  }
  const ownerKey='theSystemDataOwnerV1', archiveKey='theSystemDeviceAccountsV1';
  const deviceOnly=k=>[ownerKey,archiveKey,'theSystemCloudSession','theSystemRememberMe','theSystemCloudConfig'].includes(k);
  function accountSnapshot(storage){return Object.fromEntries(Object.keys(storage).filter(k=>owned(k)&&!deviceOnly(k)).map(k=>[k,storage.getItem(k)]));}
  function replaceAccount(storage,next){
    Object.keys(storage).filter(k=>owned(k)&&!deviceOnly(k)).forEach(k=>storage.removeItem(k));
    Object.entries(next).forEach(([k,v])=>storage.setItem(k,v));
  }
  function activateAccount(storage,userId,previousUserId){
    if(!userId)throw Error('An account is required.');
    const previousOwner=storage.getItem(ownerKey),owner=previousOwner||previousUserId;
    if(owner===userId){storage.setItem(ownerKey,userId);return false;}
    const originalArchive=storage.getItem(archiveKey);let archives={};
    try{archives=JSON.parse(originalArchive||'{}')}catch(_){throw Error('Local account saves need recovery. Export a backup before switching accounts.')}
    if(!archives||typeof archives!=='object'||Array.isArray(archives))throw Error('Local account saves need recovery.');
    const current=accountSnapshot(storage),next=cloudData(archives[userId]||{});
    // Unattributed legacy data is retained, never assigned to a new login.
    if(Object.keys(current).length)archives[owner||'unattributed']=current;
    delete archives[userId];
    try{replaceAccount(storage,{});storage.setItem(archiveKey,JSON.stringify(archives));replaceAccount(storage,next);storage.setItem(ownerKey,userId)}
    catch(error){replaceAccount(storage,{});if(originalArchive===null)storage.removeItem(archiveKey);else storage.setItem(archiveKey,originalArchive);if(previousOwner===null)storage.removeItem(ownerKey);else storage.setItem(ownerKey,previousOwner);replaceAccount(storage,current);throw error}
    return true;
  }
  function cloudData(snapshot){
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('Invalid backup snapshot');
    const entries=Object.entries(snapshot).filter(([k])=>owned(k)&&!deviceOnly(k));
    if(entries.some(([,v])=>typeof v!=='string'))throw Error('Invalid backup value');
    return Object.fromEntries(entries);
  }
  function applySnapshot(storage,next){const safe=cloudData(next),previous=accountSnapshot(storage);try{replaceAccount(storage,safe)}catch(error){replaceAccount(storage,previous);throw error}}
  async function clearDevice(local,session,cache){
    // Clear caches first: if that fails, keep the user's local data available for retry.
    if(cache){const names=await cache.keys();await Promise.all(names.filter(k=>k.startsWith('the-system-')).map(k=>cache.delete(k)));}
    [local,session].forEach(storage=>Object.keys(storage).filter(owned).forEach(k=>storage.removeItem(k)));
  }
  const api={owned,ownerKey,activateAccount,resetSnapshot,cloudData,applySnapshot,clearDevice};
  if(typeof module!=='undefined')module.exports=api;else root.AccountData=api;
})(typeof window==='undefined'?globalThis:window);
