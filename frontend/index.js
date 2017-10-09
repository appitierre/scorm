import {getSockets} from 'sockets';
import Store from 'store';
import Promise from 'bluebird';
import axios from 'axios';
import {registerHook} from 'bloom';


_.delay(function() {
    if (Store.getState().auth) {
        getSockets().on('server/scormModel', function(response) {
            console.log(response, 'response');
            window.API.model = response._tracking;
            console.log(window.API);
        });
    }
    
}, 1000)

registerHook('preLoad:course', function(courseId) {
    window.API.model = {};
    getSockets().emit('client/preLoadCourse', {courseId: courseId, userId: Store.getState().auth._id});
})

window.API = {
    model: {
    },
    LMSInitialize: function() {
        console.log('LMSInitialize', arguments);
        console.log(this.model._courseData.cmi);
        if (!this.model._courseData.cmi) return false;
        return true;
    },
    LMSFinish: function() {
        console.log('LMSFinish', arguments);
        console.log('data', this.model._courseData);
        axios.post(`../../api/scorm/${this.model._course}/${this.model._user}`, this.model);
        return true;

    },
    LMSGetValue: function(path) {
        console.log('LMSGetValue', arguments);
        return _.get(this.model._courseData, path, "");
    },
    LMSSetValue: function(path, value) {
        console.log('LMSSetValue', arguments);
        return _.set(this.model._courseData, path, value);
    },
    LMSCommit: function() {
        console.log('LMSCommit', arguments);
        console.log('data', this.model._courseData);
        axios.put(`../../api/scorm/${this.model._course}/${this.model._user}`, this.model);
        return true;
    },
    LMSGetLastError: function() {
        console.log('LMSGetLastError', arguments);
        return 0;
    },
    LMSGetErrorString: function() {
        console.log('LMSGetErrorString', arguments);
        return "";
    },
    LMSGetDiagnostic: function() {
        console.log('LMSGetDiagnostic', arguments);
        return "";
    }
}