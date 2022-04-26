// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import { App } from 'aws-cdk-lib';
import * as SyslogSecurityHub from '../lib/syslog-security-hub-stack';

test('Empty Stack', () => {
    const app = new App();
    // WHEN
    const stack = new SyslogSecurityHub.SyslogSecurityHubStack(app, 'MySyslogSecurityHubStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
