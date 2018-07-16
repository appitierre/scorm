var Promise = require('bluebird');
var xml2js = require('xml2js');
var readFile = Promise.promisify(require("fs").readFile);

/* var Converter = require("csvtojson"); */

/* var userCsvConverter =  Promise.promisify(Converter().fromFile, {context: Converter({checkType:false})});
var csvAsJson = yield userCsvConverter(uploadFilePath); */

module.exports = Promise.coroutine(function*(courseFolderPath) {

    var indexPath = 'index.html';

    var parser = new xml2js.Parser();
    var xml2jsAsPromise = Promise.promisify(parser.parseString);
    var xmlFile = yield readFile(`${courseFolderPath}imsmanifest.xml`);
    var xmlAsJs = yield xml2jsAsPromise(xmlFile);

    if (xmlAsJs.manifest.metadata[0].schemaversion[0] != '1.2') {
        throw {_statusCode: 400, message: 'This file is the wrong scorm version'}
    }

    if (xmlAsJs.manifest.resources && xmlAsJs.manifest.resources.length) {
        var resources = xmlAsJs.manifest.resources;
        if (resources[0].resource && resources[0].resource[0] && resources[0].resource[0].$ && resources[0].resource[0].$.href) {
            indexPath = resources[0].resource[0].$.href;
        }
    }

    return {
        version: '1.2',
        indexPath: indexPath
    }

})