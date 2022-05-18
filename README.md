# Welcome to Streaming Syslog to AWS Security Hub sample project!

## Overview

Most operating systems, firewalls, Intrusion Detection Systems (IDS), and Intrusion Prevention Systems (IPS) are capable of emitting events via [Syslog](https://en.wikipedia.org/wiki/Syslog). The purpose of this project is to provide a sample [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) project to create all the necessary resources for you to receive streaming Syslog events, parse and transform these events to [AWS Security Finding Format (ASFF)](https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-findings-format.html), and lastly ingest these events as findings in [AWS Security Hub](https://aws.amazon.com/security-hub/).

This project includes a sample Syslog event from The [Dragos Platform](https://www.dragos.com/) for testing purposes, and a custom AWS Lambda function for parsing and transforming Dragos events. Dragos is an industrial (ICS/OT/IIoT) cybersecurity company on a mission to safeguard civilization and is an AWS technology partner and member of the [AWS Partner Network](https://partners.amazonaws.com/partners/0010h00001jBdt3AAC/Dragos). 

This sample is provided for demonstration purposes only, to serve as a starting point to help you customize for your source systems. A basic understanding of Syslog and how the source system emitting Syslog events maps its fields to Syslog Common Event Format (CEF) is necessary for customization of this project.

*This project has a forthcoming [blog](https://aws.amazon.com/blogs/) which will provide greater detail regarding this solution.*

## Solution Overview

### Architecture

<img src="./images/syslog-security-hub.png">

## Getting Started

In order to get started, you will need an AWS account, preferably free from any production workloads. Ensure AWS Security Hub is enabled in the AWS Region where you plan to deploy the solution. To eliminate the need to setup IAM permissions and install pre-requisites, we recommend using [AWS Cloud9](https://aws.amazon.com/cloud9/).

AWS Cloud9 is a cloud-based integrated development environment (IDE) that lets you write, run, and debug your code with just a browser. Cloud9 comes pre-configured with all the pre-requisites required for this project, such as git, npm, and AWS Cloud Development Kit (CDK).

To get started, create a Cloud9 environment from the AWS console. Provide the required Name, and accept the remaining default values. Once your Cloud9 environment has been created, you can open the IDE and access a terminal window.

### Build and Deploy

From a terminal window, you will need to clone the GitHub repo, install packages, build, and deploy the CloudFormation templates. Issue the following commands in a terminal window in Cloud9. By default, the AWS CDK will prompt you to deploy changes. If you want to skip confirmations, add the following command line option to the AWS CDK commands below.
 
<code> --require-approval never</code>

#### Clone GitHub repo
<pre><code>
git clone https://github.com/aws-samples/streaming-syslog-to-aws-security-hub-sample
cd streaming-syslog-to-aws-security-hub-sample
</code></pre>

#### Bootstrap AWS Cloud Development Kit (AWS CDK v2)
<pre><code>
cdk bootstrap
</code></pre>

#### Install CDK Project required packages
<pre><code>
npm install
</code></pre>

#### Install Lambda function required packages
<pre><code>
cd src/lambda-syslog
npm install
cd ../..
</code></pre>

#### Build CDK Project
<pre><code>
npm run build
</code></pre>

#### Deploy stack
<pre><code>
cdk deploy
</code></pre>

## Verification

Once the CDK deployment process has completed, you can [open AWS Security Hub Console Findings page](https://console.aws.amazon.com/securityhub/home/findings/findings/findings?search=Title%3D%255Coperator%255C%253APREFIX%255C%253ADRAGOS#/findings?search=Title%3D%255Coperator%255C%253APREFIX%255C%253ADRAGOS) to search for Findings with a Title that starts with <code>DRAGOS</code>. If successful, you should find a Finding with the Title <code>DRAGOS: Test Message from Dragos App</code>.

## Cleanup

To cleanup, you can simply issue the following command from your Cloud9 terminal window.

<pre><code>
cdk destroy
</code></pre>

## License Summary

This library is licensed under the MIT-0 License. See the [LICENSE](./LICENSE) file.