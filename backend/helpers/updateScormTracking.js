module.exports = function(userId, courseId, trackingModel) {
    var updateObject = {};
    
    var currentTime = new Date();

    var courseData = trackingModel._courseData;
    var cmi = courseData.cmi;        

    var cmiCore = cmi.core;

    if (!trackingModel._isComplete && (cmiCore.lesson_status === 'passed' || cmiCore.lesson_status === 'completed')) {
        
        updateObject._isComplete = true;
        updateObject._progress = 100;
        updateObject._completedAt = currentTime;

        var session = trackingModel._sessions[0];

        session._updatedAt = currentTime;
        session._isComplete = true;
        session._progress = 100;

        updateObject._sessions = [session];

    } else {

        updateObject._progress = 50;
        var session = trackingModel._sessions[0];
        
        session._updatedAt = currentTime;
        session._progress = 50;

        updateObject._sessions = [session];

    }

    updateObject._updatedAt = currentTime;

    updateObject._courseData = courseData;

    return updateObject;
    
}