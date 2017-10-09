var Auth = require(global.app + '/middleware/authorization.js');
var Permissions = require(global.app + '/middleware/permissions.js');
var DefaultRouteResponse = require(global.app + '/helpers/query/defaultRouteResponse');
var Scorms = require('./controller');

module.exports = function(app, passport, io) {

    app.get('/api/scorm/:courseId/:userId', Auth.isAuthenticated, Permissions.isLearner, function(req, res) {
        Scorms.getTracking(req, function(errObject, resObject) {
            DefaultRouteResponse(res, errObject, resObject);
        });
    });

    app.put('/api/scorm/:courseId/:userId', Auth.isAuthenticated, Permissions.isLearner, function(req, res) {
        Scorms.updateTracking(req, function(errObject, resObject) {
            DefaultRouteResponse(res, errObject, resObject);
        });
    })

    app.post('/api/scorm/:courseId/:userId', Auth.isAuthenticated, Permissions.isLearner, function(req, res) {
        Scorms.finishTracking(req, function(errObject, resObject) {
            DefaultRouteResponse(res, errObject, resObject);
        });
    })
}