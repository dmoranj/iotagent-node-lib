/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
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
 * 
 * Modified work Copyright 2017 Atos Spain S.A
 */
'use strict';

var iotAgentLib = require('../../../../lib/fiware-iotagent-lib'),
    utils = require('../../../tools/utils'),
    should = require('should'),
    request = require('request'),
    nock = require('nock'),
    moment= require('moment'),
    contextBrokerMock,
    iotAgentConfig = {
        logLevel: 'FATAL',
        contextBroker: {
            host: '192.168.1.1',
            port: '1026',
            ngsiVersion: 'v2'
        },
        server: {
            port: 4041
        },
        types: {},
        service: 'smartGondor',
        subservice: 'gardens',
        providerUrl: 'http://smartGondor.com',
        deviceRegistrationDuration: 'P1M',
        throttling: 'PT5S'
    };

describe('Subscription tests', function() {
    beforeEach(function(done) {
        var optionsProvision = {
            url: 'http://localhost:' + iotAgentConfig.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/unit/ngsi20/examples/deviceProvisioningRequests/provisionMinimumDevice.json'),
            headers: {
                'fiware-service': 'smartGondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        iotAgentLib.activate(iotAgentConfig, function() {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/entities',
                    utils.readExampleFile('./test/unit/ngsi20/examples/contextRequests/createMinimumProvisionedDevice.json'))
                .reply(201);

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v2/subscriptions',function(body) {
                    var expected= utils.readExampleFile('./test/unit/ngsi20/examples/subscriptionRequests/simpleSubscriptionRequest.json')
                    if(!body.expires)
                    {
                        return false;
                    }
                    else if(moment(body.expires,"YYYY-MM-DDTHH:mm:ss.SSSZ").isValid())
                    {
                        expected.expires=body.expires;

                        if(JSON.stringify(expected)===JSON.stringify(body))
                        {
                            return true;
                        }
                        else{
                            return false;
                        }
                    }
                    else{
                        return false;
                    }
                })
                .reply(201,null,{'Location': '/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8'});

            iotAgentLib.clearAll(function() {
                request(optionsProvision, function(error, result, body) {
                    done();
                });
            });
        });
    });

    afterEach(function(done) {
        nock.cleanAll();
        iotAgentLib.setNotificationHandler();
        iotAgentLib.clearAll(function() {
            iotAgentLib.deactivate(done);
        });
    });

    describe('When a client invokes the subscribe() function for device', function() {
        it('should send the appropriate request to the Context Broker', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {

                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    should.not.exist(error);

                    contextBrokerMock.done();

                    done();
                });
            });
        });
        it('should store the subscription ID in the Device Registry', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                        should.not.exist(error);
                        should.exist(device);
                        should.exist(device.subscriptions);
                        device.subscriptions.length.should.equal(1);                       
                        device.subscriptions[0].id.should.equal('51c0ac9ed714fb3b37d7d5a8');
                        device.subscriptions[0].triggers[0].should.equal('attr_name');
                        done();
                    });
                });
            });
        });
    });
    describe('When a client invokes the unsubscribe() function for an entity', function() {
        beforeEach(function(done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .delete('/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8')
                .reply(204);

            done();
        });
        it('should change the expiration date of the subscription to 0s', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    iotAgentLib.unsubscribe(device, '51c0ac9ed714fb3b37d7d5a8', function(error) {
                        iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {

                            contextBrokerMock.done();
                            done();
                        });
                    });
                });
            });
        });
        it('should remove the id from the subscriptions array', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    iotAgentLib.unsubscribe(device, '51c0ac9ed714fb3b37d7d5a8', function(error) {
                        iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                            should.not.exist(error);
                            should.exist(device);
                            should.exist(device.subscriptions);
                            device.subscriptions.length.should.equal(0);
                            done();
                        });
                    });
                });
            });
        });
    });
    describe('When a client removes a device from the registry', function() {
        beforeEach(function(done) {
            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartGondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .delete('/v2/subscriptions/51c0ac9ed714fb3b37d7d5a8')
                .reply(204);

            done();
        });

        it('should change the expiration dates of all its subscriptions to 0s', function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    iotAgentLib.unregister(device.id, 'smartGondor', '/gardens', function(error) {
                        contextBrokerMock.done();
                        done();
                    });
                });
            });
        });
    });
    describe('When a new notification comes to the IoTAgent', function() {
        beforeEach(function(done) {
            iotAgentLib.getDevice('MicroLight1', 'smartGondor', '/gardens', function(error, device) {
                iotAgentLib.subscribe(device, ['attr_name'], null, function(error) {
                    done();
                });
            });
        });

        it('should invoke the user defined callback', function(done) {
            var notificationOptions = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/notify',
                    method: 'POST',
                    json: utils.readExampleFile('./test/unit/ngsi20/examples/subscriptionRequests/simpleNotification.json'),
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    }
                },

                executedHandler = false;

            function mockedHandler(device, notification, callback) {
                executedHandler = true;
                callback();
            }

            iotAgentLib.setNotificationHandler(mockedHandler);

            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                executedHandler.should.equal(true);

                done();
            });
        });
        it('should invoke all the notification middlewares before the user defined callback', function(done) {
            var notificationOptions = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/notify',
                    method: 'POST',
                    json: utils.readExampleFile('./test/unit/ngsi20/examples/subscriptionRequests/simpleNotification.json'),
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    }
                },
                executedMiddlewares = false,
                executedHandler = false,
                modifiedData = false;

            function mockedHandler(device, notification, callback) {
                executedHandler = true;
                modifiedData = notification.length === 2;
                callback();
            }

            function mockedMiddleware(device, notification, callback) {
                executedMiddlewares = true;
                notification.push({
                    name: 'middlewareAttribute',
                    type: 'middlewareType',
                    value: 'middlewareValue'
                });

                callback(null, device, notification);
            }

            iotAgentLib.addNotificationMiddleware(mockedMiddleware);
            iotAgentLib.setNotificationHandler(mockedHandler);

            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                executedHandler.should.equal(true);
                executedMiddlewares.should.equal(true);
                modifiedData.should.equal(true);
                done();
            });
        });
        it('should get the correspondent device information', function(done) {
            var notificationOptions = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/notify',
                    method: 'POST',
                    json: utils.readExampleFile('./test/unit/ngsi20/examples/subscriptionRequests/simpleNotification.json'),
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    }
                },
                rightFields = false;

            function mockedHandler(device, data, callback) {
                if (device && device.id === 'MicroLight1' && device.name === 'FirstMicroLight' &&
                    data && data.length === 1 && data[0].name === 'attr_name') {
                    rightFields = true;
                }

                callback();
            }

            iotAgentLib.setNotificationHandler(mockedHandler);

            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                rightFields.should.equal(true);

                done();
            });
        });
    });
    describe('When a new notification arrives to the IOTA with a non-200 code', function() {
        it('should not call the handler', function(done) {
            var notificationOptions = {
                    url: 'http://localhost:' + iotAgentConfig.server.port + '/notify',
                    method: 'POST',
                    json: utils.readExampleFile('./test/unit/ngsi20/examples/subscriptionRequests/errorNotification.json'),
                    headers: {
                        'fiware-service': 'smartGondor',
                        'fiware-servicepath': '/gardens'
                    }
                },

                executedHandler = false;

            function mockedHandler(device, notification, callback) {
                executedHandler = true;
                callback();
            }

            iotAgentLib.setNotificationHandler(mockedHandler);

            request(notificationOptions, function(error, response, body) {
                should.not.exist(error);
                executedHandler.should.equal(false);

                done();
            });
        });
    });
});
