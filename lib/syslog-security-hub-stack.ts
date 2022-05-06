// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {App,CfnOutput,Stack,StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { KinesisStreamsToLambda } from '@aws-solutions-constructs/aws-kinesisstreams-lambda';

export class SyslogSecurityHubStack extends Stack {
  
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    const kinesisStreamsToLambda = new KinesisStreamsToLambda(this, 'syslog-security-hub-stream-lambda', {
      kinesisEventSourceProps: {
          startingPosition: lambda.StartingPosition.TRIM_HORIZON,
          batchSize: 1
      },
      lambdaFunctionProps: {
          runtime: lambda.Runtime.NODEJS_14_X,
          code: lambda.Code.fromAsset(path.join(__dirname, '/../src/lambda-syslog')),
          handler: 'index.handler'
      }
    });

    //  Add AWS Managed Policy to allow Lambda function to import findings into AWS Security Hub
    kinesisStreamsToLambda.lambdaFunction?.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSSecurityHubFullAccess'));
    
    //  Create Elastic IP (EIP) for external systems to send Syslog events to the system.
    const eip = new ec2.CfnEIP(this, "syslog-security-hub-eip");
    
    //  Create a new VPC w/ a single public subnet for the newly created EC2 Instance
    const vpc = new ec2.Vpc(this, 'syslog-security-hub-vpc', { 
      maxAzs: 1,
      subnetConfiguration: [
			{
				cidrMask: 26,
				name: 'syslog-security-hub-public-subnet',
				subnetType: ec2.SubnetType.PUBLIC,
			}]
    });

    //  Restrict ingress to TCP/5140 from the VPC CIDR Block. Note: Must use SSM Session Manager rather than ssh for interactive shell. https://aws.amazon.com/blogs/mt/vr-beneficios-session-manager/
    const securityGroup = new ec2.SecurityGroup(this, 'syslog-security-hub-security-group', { vpc, allowAllOutbound: true });

    //  SECURITY TIP: Additional CIDR Blocks may be added as Ingress Rules if access outside the VPC is desired
    //  via the VPC's associated Internet Gateway and the Elastic IP Address (EIP) attached to the EC2 instance.
    securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(5140));

    //  Create EC2 instance for Fluentd, as well as any interactions (e.g. sending sample syslog event to system)
    const instance = new ec2.Instance(this, 'syslog-security-hub-ec2-instance', 
      {
        vpc, 
        vpcSubnets: vpc.selectSubnets({
					subnetType: ec2.SubnetType.PUBLIC
				}),
				securityGroup: securityGroup,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        })
      }
    );
    
    //	Add Managed Policy for SSM Session Manager access, and Kinesis full access
		instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
		instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFullAccess'));

    //  Install and configure Fluentd (td-agent) when EC2 instance is launched
    instance.userData.addCommands(
      'yum update -y',
      'yum install nc -y',
      'wget https://streaming-syslog-to-aws-security-hub-sample.s3.amazonaws.com/td-agent-4.2.0-1.amzn2.x86_64.rpm',
      'wget https://streaming-syslog-to-aws-security-hub-sample.s3.amazonaws.com/sample-syslog.txt',
      'read YYYY MM DD <<<$(date +"%Y %m %d")',
      'sed -i "s/2022-04-04/$YYYY-$MM-$DD/g" sample-syslog.txt',
      'sed -i "s/id=12345678/id=$(date +%s)/g" sample-syslog.txt',
      'chmod +x td-agent-4.2.0-1.amzn2.x86_64.rpm',
      'rpm --install td-agent-4.2.0-1.amzn2.x86_64.rpm',
      '/usr/sbin/td-agent-gem install fluent-plugin-kinesis -v 3.4.2',
      'cp /etc/td-agent/td-agent.conf /etc/td-agent/td-agent.conf.backup',
      'echo "<source>" > /etc/td-agent/td-agent.conf',
      'echo "    @type syslog" >> /etc/td-agent/td-agent.conf',
      'echo "    port 5140" >> /etc/td-agent/td-agent.conf',
      'echo "    bind 0.0.0.0" >> /etc/td-agent/td-agent.conf',
      'echo "    tag *" >> /etc/td-agent/td-agent.conf',
      'echo "    <parse>" >> /etc/td-agent/td-agent.conf',
      'echo "        @type regexp" >> /etc/td-agent/td-agent.conf',
      'echo "        expression /^(?<data>.*)$/" >> /etc/td-agent/td-agent.conf',
      'echo "    </parse>" >> /etc/td-agent/td-agent.conf',
      'echo "    <transport tcp>" >> /etc/td-agent/td-agent.conf',
      'echo "    </transport>" >> /etc/td-agent/td-agent.conf',      
      'echo "</source>" >> /etc/td-agent/td-agent.conf',
      'echo "" >> /etc/td-agent/td-agent.conf',
      'echo "<match **>" >> /etc/td-agent/td-agent.conf',
      'echo "# plugin type" >> /etc/td-agent/td-agent.conf',
      'echo "@type kinesis_streams" >> /etc/td-agent/td-agent.conf',
      'echo "" >> /etc/td-agent/td-agent.conf',
      'echo "# your kinesis stream name" >> /etc/td-agent/td-agent.conf',
      'echo "stream_name ' + kinesisStreamsToLambda.kinesisStream.streamName + '" >> /etc/td-agent/td-agent.conf',
      'echo "" >> /etc/td-agent/td-agent.conf',
      'echo "# AWS region" >> /etc/td-agent/td-agent.conf',
      'echo "region ' + Stack.of(this).region + '" >> /etc/td-agent/td-agent.conf',
      'echo "" >> /etc/td-agent/td-agent.conf',
      'echo "  <buffer>" >> /etc/td-agent/td-agent.conf',
      'echo "    flush_interval 1" >> /etc/td-agent/td-agent.conf',
      'echo "    chunk_limit_size 1m" >> /etc/td-agent/td-agent.conf',
      'echo "    flush_thread_interval 0.1" >> /etc/td-agent/td-agent.conf',
      'echo "    flush_thread_burst_interval 0.01" >> /etc/td-agent/td-agent.conf',
      'echo "    flush_thread_count 15" >> /etc/td-agent/td-agent.conf',
      'echo "  </buffer>" >> /etc/td-agent/td-agent.conf',
      'echo "  " >> /etc/td-agent/td-agent.conf',
      'echo "</match>" >> /etc/td-agent/td-agent.conf',
      'systemctl restart td-agent',
      'running=0; x=0; while [ $running -eq 0 -a $x -le 1000 ]; do running=$(systemctl status td-agent | grep -i "active (running)" | wc -l) x=$(( $x + 1 )); done; echo $x;',
      'sleep 5',
      'cat sample-syslog.txt | nc 127.0.0.1 5140'
    );
    
    //  Associate EIP to newly created EC2 instance.
    const ec2Assoc = new ec2.CfnEIPAssociation(this, 'syslog-security-hub-ec2-eip-association', {
      eip: eip.ref,
      instanceId: instance.instanceId
    });
 
  }
}