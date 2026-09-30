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
  function cloudData(snapshot){return Object.fromEntries(Object.entries(snapshot).filter(([k])=>owned(k)&&!['theSystemCloudSession','theSystemRememberMe','theSystemCloudConfig'].includes(k)));}
  function applySnapshot(storage,next){Object.keys(storage).filter(k=>owned(k)&&!(k in next)).forEach(k=>storage.removeItem(k));Object.entries(next).forEach(([k,v])=>storage.setItem(k,v));}
  async function clearDevice(local,session,cache){
    // Clear caches first: if that fails, keep the user's local data available for retry.
    if(cache){const names=await cache.keys();await Promise.all(names.filter(k=>k.startsWith('the-system-')).map(k=>cache.delete(k)));}
    [local,session].forEach(storage=>Object.keys(storage).filter(owned).forEach(k=>storage.removeItem(k)));
  }
  const api={owned,resetSnapshot,cloudData,applySnapshot,clearDevice};
  if(typeof module!=='undefined')module.exports=api;else root.AccountData=api;
})(typeof window==='undefined'?globalThis:window);
