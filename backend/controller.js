var Promise = require('bluebird');
var Course = require(`${global.app}/models/course`);
var Courses = require(`${global.app}/controllers/courses`);
var Tracking = require(`${global.app}/models/tracking`);
var Settings = require(`${global.app}/models/settings`);
var User = require(`${global.app}/models/user`);
var async = require('async');
var moment = require('moment');
var uploadFileToDestination = Promise.promisify(require(`${global.app}/helpers/assets/uploadFileToDestination`));
var unzipFileToDestination = Promise.promisify(require(`${global.app}/helpers/assets/unzipFileToDestination`));
var setUpdatedOnModel = require(`${global.app}/helpers/utils/setUpdatedOnModel`);
var errorResponses = require(`${global.app}/helpers/utils/errorResponses`);
var getImsManifestDetails = require('./helpers/getImsManifestDetails');
var Sockets = require(`${global.app}/sockets`);
var updateScormTracking = require('./helpers/updateScormTracking');
var getDefaultScormAttributes = require('./helpers/getDefaultScormAttributes');

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

            Sockets.io.emit('courses:evolveCourseUploadUpdate', {_step: "1/3", _course: course, _progress: null});
            yield uploadFileToDestination(uploadFilePath, uploadDestinationPath);
            Sockets.io.emit('courses:evolveCourseUploadUpdate', {_step: "2/3", _course: course, _progress: 0});
            yield unzipFileToDestination(uploadDestinationPath, unzippedDestinationPath, (progress) => {
                Sockets.io.emit('courses:evolveCourseUploadUpdate', {_step: "2/3", _course: course, _progress: progress});
            });
            Sockets.io.emit('courses:evolveCourseUploadUpdate', {_step: "3/3", _course: course, _progress: null});

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

        var settings = yield Settings.findOne({});

        var query = { _id: courseId };
        if (settings._general._shouldUseUrlSlugs) {
            query = { _urlSlug: courseId };
        }
        
        var courseModel = yield Course.findOne(query);
        
        if (courseModel._courseType != 'scorm') {
            return;
        }

        var userModel = yield User.findById(userId);
        
        if (userModel._role != 'learner') {
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
                _courseData: getDefaultScormAttributes(userModel)
            }
            socket.emit('server/scormModel', {_tracking: trackingData});
            return;
        }

        var trackingModel = yield Tracking.findOne({_user: req.userId, _course: courseId});

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
                _courseData: getDefaultScormAttributes(userModel)
            }

            var trackingModel = yield Tracking.create(trackingData);
        }

        // This is a catch to make sure the model has some sort of cmi default
        if (!trackingModel._courseData || !trackingModel._courseData['cmi']) {
            trackingModel._courseData = getDefaultScormAttributes(userModel);
        }
        
        socket.emit('server/scormModel', {_tracking: trackingModel});

    }),

    updateTracking: Promise.coroutine(function*(req, callback) {
        try {
            var userId = req.params.userId;
            var courseId = req.params.courseId;
            var trackingModel = req.body;

            if (req.user._role != 'learner') {
                return callback(null, {_tracking: trackingModel});
            }

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

            if (req.user._role != 'learner') {
                return callback(null, {_tracking: trackingModel});
            }

            var updatedScormTracking = updateScormTracking(userId, courseId, trackingModel, true);

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