import { Injectable } from '@angular/core';

import { settings } from './settings';

import * as AWS from 'aws-sdk';
//var AWS: any;

var isDebug;

@Injectable()
export class S3 {

	public makeS3Url: any;
	public viewAlbum:	any;
	public getObjectS3:	any;

	constructor() {

		isDebug = settings.settings.isDebug === true;

		// Returns promise containing next incomming message or EOF.

		function receiveS3Url (bucket, key) {
			bucket	=	'clde-attachment-storage';
			key	=	'1000026/0/208/1021128/401-10228.jpg';
			var s3 = new AWS.S3();
			var params = {Bucket: bucket, Key: key};

			return s3.getSignedUrl('putObject', params);
		}
		this.makeS3Url = function (bucket, key) {
			return receiveS3Url(bucket, key);
		};

		this.getObjectS3 = function (bucket, key):	Promise<any> {
			return new Promise<any>(function (resolve) {
				bucket	=	'clde-attachment-storage';
				// key	=	'1000026/0/208/1021128/401-10228.jpg';
				var s3 = new AWS.S3({
					signatureVersion: 'v4'
				});
				var params = {Bucket: bucket, Key: key};

				s3.getObject(params, function(err, data) {
					// if (err) console.log(err, err.stack); // an error occurred
					// else     console.log(data);           // successful response
					resolve({
						err: err,
						data: data,
						eof: false, // end of file
					});
					return;
				});
			});
		};

		this.viewAlbum = function() {
			var	albumBucketName	=	'clde-attachment-storage';
			var albumName	=	'1000026';
			var s3 = new AWS.S3();
			var albumPhotosKey = encodeURIComponent(albumName) + '//';
			s3.listObjects({Bucket:	albumBucketName,	Prefix: albumPhotosKey}, function(err, data) {
				if (err) {
					return alert('There was an error viewing your album: ' + err.message);
				}
				// `this` references the AWS.Response instance that represents the response
				var href = this.request.httpRequest.endpoint.href;
				var bucketUrl = href + albumBucketName + '/';

				data.Contents.map(function(photo) {
					var photoKey = photo.Key;
					var photoUrl = bucketUrl + encodeURIComponent(photoKey);
					return photoUrl;
				});
			});
		};
	}
}
