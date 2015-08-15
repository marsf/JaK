/* global MozActivity */
document.getElementById('back').addEventListener('click', function() {
  document.addEventListener('visibilitychange', function() {
    // Close ourself after the activity transition is completed.
    window.close();
  });

  var geckoVer = (window.navigator.userAgent.split('/').pop()) + 0,
      // Firefox OS 2.2 == Gecko 37.0
      activityName = (geckoVer < 37.0) ? 'configure' : 'moz_configure_window';
  var activity = new MozActivity({
    name: activityName,
    data: { target: 'device' }
  });
});
