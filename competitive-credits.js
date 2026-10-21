/* Competitive credits are issued by the server; local XP remains personal progress. */
(() => {
 const key='systemCompetitiveCreditV1',baseStart=startWorkoutMode,baseFinish=finishWorkout;
 let starting=null;
 function owner(){return getCloudSession()?.user?.id;}
 async function begin(){
  const user=owner();if(!user||!navigator.onLine)return;
  try{await syncSocialProfile();if(owner()!==user)return;const mode=missionForMode(adaptiveSystemMission()).mode||'full';
   const credit=await cloudRequest('/rest/v1/rpc/workout_credit',{method:'POST',body:JSON.stringify({action:'start',mode})});
   if(owner()===user)localStorage.setItem(key,JSON.stringify({...credit,owner:user}));
  }catch(_){if(owner()===user)window.SystemOS?.notify('Personal progress is saved. Competitive points need an online workout.','TRAINING POINTS');}
 }
 startWorkoutMode=function(){const result=baseStart.apply(this,arguments);if(document.getElementById('workoutMode')?.classList.contains('active')&&!starting)starting=begin().finally(()=>starting=null);return result;};
 finishWorkout=function(){const user=owner(),result=baseFinish.apply(this,arguments);
  (async()=>{try{if(starting)await starting;if(!user||owner()!==user)return;const credit=JSON.parse(localStorage.getItem(key)||'null');if(credit?.owner!==user||!credit.id)return;
   const earned=await cloudRequest('/rest/v1/rpc/workout_credit',{method:'POST',body:JSON.stringify({action:'complete',credit_id:credit.id})});
   if(owner()!==user)return;localStorage.setItem(key,JSON.stringify({...earned,owner:user}));await syncSocialProfile();
  }catch(_){if(owner()===user)window.SystemOS?.notify('Workout saved. Competitive points have not been awarded.','TRAINING POINTS');}})();return result;
 };
})();
