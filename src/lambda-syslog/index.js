// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

'use strict';
console.log('Loading Dragos Syslog Parser + ASFF TransformLambda function');

const parser = require('nsyslog-parser');

const aws= require('aws-sdk');
const securityhub = new aws.SecurityHub();

function getSeverityLabel(severity) {

    //  Dragos  SecurityHub    
    //  5	    CRITICAL
    //  4	    HIGH
    //  3	    MEDIUM
    //  1,2	    LOW
    //  0	    INFORMATIONAL

    if (severity == 0) return 'INFORMATIONAL';
    else if (severity == 1 || severity == 2) return 'LOW';
    else if (severity == 3) return 'MEDIUM';
    else if (severity == 4) return 'HIGH';
    else if (severity == 5) return 'CRITICAL';
    
}

const RECORDSTATE_ACTIVE = "ACTIVE";

exports.handler = async (event, context) => {

    const awsAccountId = JSON.stringify(context.invokedFunctionArn).split(':')[4];
    const awsRegion = process.env.AWS_REGION;
    
    var findings = [];

    event.Records.forEach(function(record) {
        // Kinesis data is base64 encoded so decode here
        const data = Buffer.from(record.kinesis.data, 'base64').toString('ascii');
        console.log('Syslog Record:', data);
        var syslogJson = JSON.parse(data);
        if (syslogJson.data != null && syslogJson.data.length > 0) {
            var syslogRecord = parser(syslogJson.data);
            console.log(syslogRecord);
            //  Expecting CEF (Common Event Format)
            try {
                var finding = {
                    "SchemaVersion": "2018-10-08",
                    "Id": syslogRecord['fields']['id'],
                    "ProductArn": `arn:aws:securityhub:${awsRegion}:${awsAccountId}:product/${awsAccountId}/default`,
                    "GeneratorId": syslogRecord['fields']['detectorId'],
                    "AwsAccountId": awsAccountId,
                    "Compliance": {'Status': 'FAILED'},
                    "Types": [
                        `${syslogRecord['cef']['deviceVendor']}:${syslogRecord['cef']['deviceProduct']}:${syslogRecord['cef']['deviceVersion']}:${syslogRecord['cef']['deviceEventClassID']}`,
                        `${syslogRecord['fields']['detection_quad']}:${syslogRecord['fields']['type']}`
                    ],
                    "CreatedAt": new Date(syslogRecord['fields']['createdAt']).toISOString(),
                    "UpdatedAt": new Date(syslogRecord['fields']['createdAt']).toISOString(),
                    "FirstObservedAt": new Date(syslogRecord['fields']['occurredAt']).toISOString(),
                    "Severity": {
                        "Label": getSeverityLabel(parseInt(syslogRecord['cef']['severity'],10))
                    },
                    "Title": 'DRAGOS: '+ syslogRecord['cef']['name'],
                    "Description": syslogRecord['fields']['content'],
                    'Remediation': {
                        'Recommendation': {
                            'Text': 'For directions on how to fix this issue, start mitigation action in Dragos console',
                            'Url': 'https://dragos.com'
                        }
                    },
                    "ProductFields": {
                        "ProviderName": syslogRecord['cef']['deviceVendor'],
                        "ProviderVersion": syslogRecord['cef']['deviceVersion'],
                    },
                    'Resources': [
                        {
                            'Type': 'Other',
                            'Id': 'OT-ASSET-DST-ID-' + syslogRecord['fields']['dst_asset_id'],
                            "Details": {
                                'Other': {
                                    'hostname': syslogRecord['fields']['dst_asset_hostname'],
                                    'ip': syslogRecord['fields']['dst_asset_ip'],
                                    'mac': syslogRecord['fields']['dst_asset_mac'],
                                    'domain': syslogRecord['fields']['dst_asset_domain'],
                                    'vendor': syslogRecord['fields']['dst_asset_vendor'],
                                    'type': syslogRecord['fields']['dst_asset_type'],
                                    'class': syslogRecord['fields']['dst_asset_class'],
                                    'zone': syslogRecord['fields']['dst_asset_zone']
                                }
                            }
                        },
                        {
                            'Type': 'Other',
                            'Id': 'OT-ASSET-SRC-ID:' + syslogRecord['fields']['src_asset_id'],
                            "Details": {
                                'Other': {
                                    'hostname': syslogRecord['fields']['src_asset_hostname'],
                                    'ip': syslogRecord['fields']['src_asset_ip'],
                                    'mac': syslogRecord['fields']['src_asset_mac'],
                                    'domain': syslogRecord['fields']['src_asset_domain'],
                                    'vendor': syslogRecord['fields']['src_asset_vendor'],
                                    'type': syslogRecord['fields']['src_asset_type'],
                                    'class': syslogRecord['fields']['src_asset_class'],
                                    'zone': syslogRecord['fields']['src_asset_zone']
                                }
                            }
                        }
                    ],    
                    'Workflow': {'Status': 'NEW'},
                    'RecordState': RECORDSTATE_ACTIVE
                };
            
                findings.push(finding);
            } catch (error) {
                console.error(error);
            }
        }
    });

    if (findings.length > 0) {
        console.log("findings: " + JSON.stringify(findings));
        
        //  Send findings to AWS Security Hub
        var params = {'Findings': findings};
        try {
            const securityHubResponse = await securityhub.batchImportFindings(params).promise();
            console.log(securityHubResponse);
        } catch (err) {
            console.error(err);
        }
    }
    
    let responseBody = {
        message: 'Dragos Syslog Record processing',
        input: event
    };
    
    let response = {
        statusCode: 200,
        body: JSON.stringify(responseBody)
    };
    
    return response;
    
};