/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of fiware-iotagent-lib
 *
 * fiware-iotagent-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * fiware-iotagent-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with fiware-iotagent-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */
'use strict';

var iotAgentLib = require('../../'),
    utils = require('../tools/utils'),
    should = require('should'),
    nock = require('nock'),
    async = require('async'),
    request = require('request'),
    contextBrokerMock,
    iotAgentConfig = {
        logLevel: 'FATAL',
        contextBroker: {
            host: '10.11.128.16',
            port: '1026'
        },
        server: {
            port: 4041,
            baseRoot: '/'
        },
        types: {},
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    };

describe('Device provisioning API: Update provisioned devices', function() {
    var provisioning1Options = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices',
            method: 'POST',
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            json: utils.readExampleFile('./test/unit/deviceProvisioningRequests/provisionNewDevice.json')
        },
        provisioning2Options = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices',
            method: 'POST',
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            json: utils.readExampleFile('./test/unit/deviceProvisioningRequests/provisionAnotherDevice.json')
        };

    beforeEach(function(done) {
        iotAgentLib.activate(iotAgentConfig, function() {
            contextBrokerMock = nock('http://10.11.128.16:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile(
                    './test/unit/contextAvailabilityRequests/registerProvisionedDevice.json'))
                .reply(200,
                utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerProvisionedDeviceSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile(
                    './test/unit/contextAvailabilityRequests/registerProvisionedDevice2.json'))
                .reply(200,
                utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/registerProvisionedDeviceSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/NGSI9/registerContext',
                utils.readExampleFile(
                    './test/unit/contextAvailabilityRequests/updateIoTAgent2.json'))
                .reply(200,
                utils.readExampleFile(
                    './test/unit/contextAvailabilityResponses/updateIoTAgent1Success.json'));

            async.series([
                iotAgentLib.clearAll,
                async.apply(request, provisioning1Options),
                async.apply(request, provisioning2Options)
            ], function(error, results) {
                done();
            });
        });
    });

    afterEach(function(done) {
        iotAgentLib.deactivate(done);
    });

    describe('When a request to update a provision device arrives', function() {
        var optionsUpdate = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices/Light1',
            method: 'PUT',
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            json: utils.readExampleFile('./test/unit/deviceProvisioningRequests/updateProvisionDevice.json')
        };

        it('should return a 200 OK and no errors', function(done) {
            request(optionsUpdate, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should have updated the data when asking for the particular device', function(done) {
            request(optionsUpdate, function(error, response, body) {
                var options = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices/Light1',
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    },
                    method: 'GET'
                };

                request(options, function(error, response, body) {
                    /* jshint camelcase:false */

                    var parsedBody = JSON.parse(body);
                    parsedBody.entity_name.should.equal('ANewLightName');
                    parsedBody.timezone.should.equal('Europe/Madrid');
                    done();
                });
            });
        });

        it('should not modify the attributes not present in the update request', function(done) {
            request(optionsUpdate, function(error, response, body) {
                var options = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices/Light1',
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    },
                    method: 'GET'
                };

                request(options, function(error, response, body) {
                    /* jshint camelcase:false */

                    var parsedBody = JSON.parse(body);
                    parsedBody.entity_type.should.equal('TheLightType');
                    parsedBody.service.should.equal('smartGondor');
                    done();
                });
            });
        });
    });
    describe('When a request to update a provision device arrives with a new Device ID', function() {
        var optionsUpdate = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices/Light1',
            method: 'PUT',
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            },
            json: utils.readExampleFile('./test/unit/deviceProvisioningRequests/updateProvisionDeviceWithId.json')
        };

        it('should raise a 400 error', function(done) {
            request(optionsUpdate, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(400);
                done();
            });
        });
    });
});
