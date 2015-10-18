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
 * please contact with::daniel.moranjimenez@telefonica.com
 */
'use strict';

var async = require('async'),
    restUtils = require('./restUtils'),
    ngsi = require('./ngsiService'),
    logger = require('fiware-node-logger'),
    errors = require('../errors'),
    _ = require('underscore'),
    context = {
        op: 'IoTAgentNGSI.DeviceProvisioning'
    },
    apply = async.apply,
    mandatoryHeaders = [
        'fiware-service',
        'fiware-servicepath'
    ],
    provisioningAPITranslation = {
        /* jshint camelcase:false */

        name: 'id',
        service: 'service',
        service_path: 'subservice',
        entity_name: 'name',
        entity_type: 'type',
        timezone: 'timezone',
        attributes: 'active',
        commands: 'lazy',
        internal_attributes: 'internalAttributes'
    };

/**
 * Express middleware to handle incoming device provisioning requests. Every request is validated and handled to the
 * NGSI Service for the registration.
 */
function handleProvision(req, res, next) {
    function handleProvisioningFinish(error, results) {
        if (error) {
            logger.debug(context, 'Device provisioning failed due to the following error: ', error.message);
            next(error);
        } else {
            logger.debug(context, 'Device provisioning request succeeded');
            res.status(200).json({});
        }
    }

    function registerDevice(service, subservice, body, callback) {
        /*jshint sub:true */
        ngsi.register({
                id: body['name'],
                type: body['entity_type'],
                name: body['entity_name'],
                service: service,
                subservice: subservice,
                active: body['attributes'],
                staticAttributes: body['static_attributes'],
                lazy: body['lazy'],
                commands: body['commands'],
                timezone: body['timezone'],
                internalAttributes: body['internal_attributes'],
                internalId: null
            },
            callback);
    }

    logger.debug('Handling device provisioning request.');

    async.waterfall([
        apply(restUtils.checkMandatoryQueryParams,
            ['name', 'entity_type'], req.body),
        apply(registerDevice, req.headers['fiware-service'], req.headers['fiware-servicepath'])
    ], handleProvisioningFinish);
}

/**
 * Express middleware that retrieves the complete set of provisioned devices (in JSON format).
 */
function handleListDevices(req, res, next) {
    ngsi.listDevices(
        req.headers['fiware-service'],
        req.headers['fiware-servicepath'],
        req.query.limit,
        req.query.offset,
        function handleListDevices(error, deviceList) {
            if (error) {
                next(error);
            } else {
                res.status(200).json(deviceList);
            }
        });
}

/**
 * Translate between the inner model format to the external Device Provisioning API one.
 *
 * @param {Object} device           Device object coming from the registry.
 * @return {Object}                 Device object translated to Device Provisioning API format.
 */
function toProvisioningAPIFormat(device) {
    /* jshint camelcase:false */
    return {
        name: device.id,
        service: device.service,
        service_path: device.subservice,
        entity_name: device.name,
        entity_type: device.type,
        timezone: device.timezone,
        attributes: device.active,
        lazy: device.lazy,
        static_attributes: device.staticAttributes,
        internal_attributes: device.internalAttributes
    };
}

/**
 * This middleware gets de device specified in the deviceId parameter of the URL from the registry and returns it in
 * JSON format.
 */
function handleGetDevice(req, res, next) {
    ngsi.getDevice(req.params.deviceId, function(error, device) {
        if (error) {
            next(error);
        } else if (device) {
            res.status(200).json(toProvisioningAPIFormat(device));
        } else {
            next(new errors.DeviceNotFound(req.params.deviceId));
        }
    });
}

/**
 * This middleware handles the removal of a particular device specified with the deviceId.
 */
function handleRemoveDevice(req, res, next) {
    ngsi.unregister(req.params.deviceId, function(error) {
        if (error) {
            next(error);
        } else {
            res.status(200).send();
        }
    });
}

/**
 * This middleware handles updates in the provisioning devices. The only attribute
 */
function handleUpdateDevice(req, res, next) {
    if (req.body.name) {
        next(new errors.BadRequest('Can\'t change the ID of a preprovisioned device'));
    } else {
        ngsi.getDevice(req.params.deviceId, function(error, device) {
            if (error) {
                next(error);
            } else if (device) {
                var pairs = _.pairs(req.body);

                for (var i in pairs[0]) {
                    device[provisioningAPITranslation[pairs[i][0]]] = pairs[i][1];
                }

                ngsi.updateRegister(device, function handleDeviceUpdate(error) {
                    if (error) {
                        next(error);
                    } else {
                        res.status(200).json(device);
                    }
                });
            } else {
                next(new errors.DeviceNotFound(req.params.deviceId));
            }
        });
    }
}

/**
 * Load the routes related to device provisioning in the Express App.
 *
 * @param {Object} router      Express request router object.
 */
function loadContextRoutes(router) {
    router.post('/iot/devices',
        restUtils.checkRequestAttributes('headers', mandatoryHeaders), handleProvision);

    router.get('/iot/devices',
        restUtils.checkRequestAttributes('headers', mandatoryHeaders), handleListDevices);

    router.get('/iot/devices/:deviceId',
        restUtils.checkRequestAttributes('headers', mandatoryHeaders), handleGetDevice);

    router.put('/iot/devices/:deviceId',
        restUtils.checkRequestAttributes('headers', mandatoryHeaders), handleUpdateDevice);

    router.delete('/iot/devices/:deviceId',
        restUtils.checkRequestAttributes('headers', mandatoryHeaders), handleRemoveDevice);
}

exports.loadContextRoutes = loadContextRoutes;
