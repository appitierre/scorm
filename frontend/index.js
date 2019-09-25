import {getSockets} from 'sockets';
import Store from 'store';
import Promise from 'bluebird';
import axios from 'axios';
import {registerHook} from 'bloom';


_.delay(function() {
    if (Store.getState().auth) {
        getSockets().on('server/scormModel', function(response) {

            window.API.model = response._tracking;

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
        if (!this.model._courseData.cmi) return false;
        return "true";
    },
    LMSFinish: function() {
        axios.post(`../../api/scorm/${this.model._course}/${this.model._user}`, this.model);
        return "true";

    },
    LMSGetValue: function(path) {
        return `${_.get(this.model._courseData, path, "")}`;
    },
    LMSSetValue: function(path, value) {
        return `${_.set(this.model._courseData, path, value)}`;
    },
    LMSCommit: function() {
        axios.put(`../../api/scorm/${this.model._course}/${this.model._user}`, this.model)
        .then((response) => {
            this.model = response.data._tracking;
        })
        return "true";
    },
    LMSGetLastError: function() {
        return 0;
    },
    LMSGetErrorString: function() {
        return "";
    },
    LMSGetDiagnostic: function() {
        return "";
    }
}