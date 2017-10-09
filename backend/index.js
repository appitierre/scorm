var Bloom = require(global.app + '/bloom');
var Scormzy = require('./controller');
var Promise = require('bluebird');
var Course = require(`${global.app}/models/course`);
var Tracking = require(`${global.app}/models/tracking`);
var moment = require('moment');

Bloom.registerPlugin('scorm', function(app, passport, io) {
    Bloom.registerCourseType('scorm', 'Scorm Course', Scormzy.uploadCourse, Scormzy.unloadCourse, Scormzy.courseRouteCallback)
    
    require('./routes')(app, passport, io);
        
    io.on('connection', function (socket) {
        
        socket.on('client/preLoadCourse', function(req) {
            Scormzy.preLoadScormModel(req, socket);
        })
    });

});