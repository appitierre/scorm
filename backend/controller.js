var Promise = require('bluebird');
var Course = require(`${global.app}/models/course`);
var Courses = require(`${global.app}/controllers/courses`);
var Tracking = require(`${global.app}/models/tracking`);
var User = require(`${global.app}/models/user`);
var async = require('async');
var moment = require('moment');
var uploadFileToDestination = Promise.promisify(require(`${global.app}/helpers/assets/uploadFileToDestination`));
var unzipFileToDestination = Promise.promisify(require(`${global.app}/helpers/assets/unzipFileToDestination`));
var removeFolder = require(`${global.app}/helpers/utils/removeFolder`);
var removeCourseAndTracking = require(`${global.app}/helpers/courses/removeCourseAndTracking`);
var setUpdatedOnModel = require(`${global.app}/helpers/utils/setUpdatedOnModel`);
var errorResponses = require(`${global.app}/helpers/utils/errorResponses`);
var getImsManifestDetails = require('./helpers/getImsManifestDetails');
var Sockets = require(`${global.app}/sockets`);
var updateScormTracking = require('./helpers/updateScormTracking');

module.exports = {
    uploadCourse: Promise.coroutine(function*(courseFile, courseId, req, callback) {

        try {
            
            if (courseFile.mimetype !== 'application/zip') {
                if (courseFile.mimetype !== 'application/x-zip-compressed') {
                    throw errorResponses.unsupportedMediaType;
                }
            }
    
            var uploadFilePath = courseFile.path;
            var uploadDestinationPath = `${global.root}/public/courses/${courseId}/${courseId}.zip`;
            var unzippedDestinationPath = `${global.root}/public/courses/${courseId}/`;

            var updateObject = {
                _hasCourse: true
            }

            yield uploadFileToDestination(uploadFilePath, uploadDestinationPath);

            yield unzipFileToDestination(uploadDestinationPath, unzippedDestinationPath);

            var manifestDetails = yield getImsManifestDetails(unzippedDestinationPath);

            updateObject._hasCourse = true;

            updateObject._courseTypeData = {
                version: manifestDetails.version,
                indexPath: manifestDetails.indexPath
            }
            
            setUpdatedOnModel(updateObject, req.user);

            var course = yield Course.findByIdAndUpdate(courseId, updateObject, {new: true});

            // Once upload the course we should update all tracking models
            yield Tracking.update({_course: courseId, _hasStarted: true}, {_courseData: {}}, { multi: true });

            callback(null, {_course: course});

        } catch (error) {
            if (!error._statusCode) {
                return callback({_statusCode: 500, message: error.message});
            }
            return callback(error);
        }

    }),

    unloadCourse: function(req, callback) {
        return Courses.unloadCourse(req, callback);
    },

    courseRouteCallback: Promise.coroutine(function*(req, res, options) {
        var course = yield Course.findById(options.course._id);
        var indexPath = course._courseTypeData.indexPath;
        
        return res.sendFile(indexPath, {root: `${global.root}/public/courses/${options.course._id}`});

    }),

    preLoadScormModel: Promise.coroutine(function*(req, socket) {
        
        var userId = req.userId;
        var courseId = req.courseId;
        
        var courseModel = yield Course.findById(courseId);
        
        if (courseModel._courseType != 'scorm') {
            return;
        }

        var trackingModel = yield Tracking.findOne({_user: req.userId, _course: courseId});
        var userModel = yield User.findById(userId);
        var averageTime = 0;

        if (!trackingModel) {
            // Create a new tracking model
            var currentTime = new Date();

            var trackingData = {
                _user: userId,
                _course: courseId,
                _hasStarted: true,
                _createdAt: currentTime,
                _sessions: [{
                    "_updatedAt": currentTime,
                    "_createdAt": currentTime,
                    "_isComplete": false,
                    "_progress": 0
                }],
                _courseData: {
                    cmi: {
                        core: {
                            _children: "student_id,student_name,lesson_location,credit,lesson_status,entry,score,exit",
                            student_id: userId,
                            student_name: `${userModel.lastName},${userModel.firstName}`,
                            lesson_location: "",
                            credit: "credit",
                            lesson_status: "not attempted",
                            entry: "ab initio",
                            exit: "",
                            total_time: "0000:00:00.00",
                            session_time: "0000:00:00.00",
                            score: {
                                _children: "raw",
                                raw: ""
                            }
                        },
                        suspend_data: "",
                        launch_data: ""
                    }
                }
            }

            var trackingModel = yield Tracking.create(trackingData);
        }
        
        socket.emit('server/scormModel', {_tracking: trackingModel});

    }),

    updateTracking: Promise.coroutine(function*(req, callback) {
        try {
            var userId = req.params.userId;
            var courseId = req.params.courseId;
            var trackingModel = req.body;

            var updatedScormTracking = updateScormTracking(userId, courseId, trackingModel);

            var trackingModel = yield Tracking.findOneAndUpdate({_user: userId, _course: courseId}, updatedScormTracking, {new: true});

            Sockets.io.emit('updateTracking', {_user: req.user});

            return callback(null, {_tracking: trackingModel});

        } catch (error) {
            if (!error._statusCode) {
                return callback({_statusCode: 500, message: error.message});
            }
            return callback(error);
        }
    }),

    finishTracking: Promise.coroutine(function*(req, callback) {
        try {
            var userId = req.params.userId;
            var courseId = req.params.courseId;
            var trackingModel = req.body;

            var updatedScormTracking = updateScormTracking(userId, courseId, trackingModel);

            var trackingModel = yield Tracking.findOneAndUpdate({_user: userId, _course: courseId}, updatedScormTracking, {new: true});

            Sockets.io.emit('updateTracking', {_user: req.user});

            return callback(null, {_tracking: trackingModel});

        } catch (error) {
            if (!error._statusCode) {
                return callback({_statusCode: 500, message: error.message});
            }
            return callback(error);
        }
    })
}

/* 
_type: {type: String, default: 'tracking'},
_createdAt: {type: Date, default: new Date()},
_updatedAt: {type: Date, default: new Date()},
_courseData: {},
_user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
_course: {type: mongoose.Schema.Types.ObjectId, ref: 'Course'},
_hasStarted: {type: Boolean, default: false},
_progress: {type: Number, default: 0},
_isComplete: {type: Boolean, default: false},
_completedAt: {type: Date},
_sessions: [sessionSchema]


"_updatedAt": {type: Date},
"_createdAt": {type: Date, default: new Date()},
"_isComplete": {type: Boolean},
"_progress": {type: Number}
*/

/* 
var trackingData = {
    _user: userId,
    _course: courseId,
    _hasStarted: true,
    _isComplete: true,
    _progress: 100,
    _createdAt: currentTime,
    _updatedAt: moment().add(averageTime, 'minutes'),
    _completedAt: moment().add(averageTime, 'minutes'),
    _sessions: [{
        "_updatedAt": moment().add(averageTime, 'minutes'),
        "_createdAt": currentTime,
        "_isComplete": true,
        "_progress": 100
    }]
}

Tracking.create(trackingData, function(err, trackingModel) {
    if (err) return callback(errorResponses.server);
    callback(null, trackingModel);
});

*/