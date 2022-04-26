#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { App } from 'aws-cdk-lib';
import { SyslogSecurityHubStack } from '../lib/syslog-security-hub-stack';

const app = new App();

new SyslogSecurityHubStack(app, 'SyslogSecurityHubStack', {
    env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION }
});
