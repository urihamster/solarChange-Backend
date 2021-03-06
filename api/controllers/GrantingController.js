/**
 * GrantingController
 *
 * @description :: Server-side logic for managing grantings
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var request = require('request');
var http = require('http');
var fs = require('fs');
var path = require('path');


module.exports = {

	_config: {
	   actions: false,
	   shortcuts: false,
	   rest: false
	 },


	register_new_solar_device: function(req, res){
		var new_device_data = req.body;

		console.log("Registering a new Solar");

		console.log(req.body);

		if (!req.headers.sender) return res.send(500,{error:'User not logged in'});

		new_device_data.user = req.headers.sender;
		
		var key = new_device_data.public_key;
		//new_device_data.public_key=null;

		async.waterfall([	

			function(cb){
				var callback = function(err, user){
					if (err) return cb(err);
					if (!user) return cb({error:'User does not exist'});
					return cb(null);
				};
				sails.controllers.user.get_user(req.headers.sender, callback);
			},

			// upload the proof of installation file

			/*
				for the file transfer to work the form has to include: enctype="multipart/form-data"
			*/

			function(cb){
				if (!req.body.proof) return cb({error:'No proof of installation file'});
				// var dir = path.join(__dirname, '../../assets/proofFiles/'+req.headers.sender);
				var dir = path.join(__dirname, '../../docs/proofFiles/'+req.headers.sender);
				
				if (!fs.existsSync(dir)){
    				fs.mkdirSync(dir);
					}
				// var pathName =path.join(__dirname, '../../assets/proofFiles/'+req.headers.sender+'/proof'+Date.now()+'.'+req.body.file_type);
				var pathName =path.join(__dirname, '../../docs/proofFiles/'+req.headers.sender+'/proof'+Date.now()+'.'+req.body.file_type);
				var bitmap = new Buffer(req.body.proof, 'base64');
				fs.writeFile(pathName, bitmap, function(err){
					if (err) return cb(err);
					var file_info = {location:pathName,type:req.body.file_type, external:false};
					return cb (null,file_info);
				});	
			},

			// create the solar device entry

			function(file,cb){
				new_device_data.file_info = file;
				delete new_device_data.proof;
				sails.controllers.solar_device.new_device(new_device_data,cb);
			},

			function(device,cb){
				var callback = function(err,wallet){	
					if (err) return cb(err);
					return cb(null,device,wallet);
				}

				sails.controllers.public_key.add_from_solar_device(key,device.id,device.user,callback);
			},

			function(device,wallet,cb){
				var callback = function(err,user){
					if (err) return cb(err);
					return cb(null, device,wallet, user);
				}
				sails.controllers.user.get_user(req.headers.sender,callback);
			}


			],
			function(err, results, wallet,user){
				if (err) return res.json(err);
				if (!wallet) return res.send(500, {error:'No wallet address'});
				console.log(wallet)
				results.status = 'pending';
				results.success = true;
				mailer_service.solar_device_registration(user.email,results, wallet, user);
				return res.json(results);
			});
	},


	approve_and_submit:function(req, res){

		console.log('Submitting a Solar Device to the Granting Machine');

		async.waterfall([

			function(cb){
				sails.controllers.solar_device.add_event(req.body.solar_device_id,'submitted',cb);
			},

			function(solar_devices, cb){
				var solar_device = solar_devices[0];
				var callback = function(err,user)
				{
					if (err) return cb(err);
					solar_device.user = user;
					cb (null,solar_device)
				}
				sails.controllers.user.getUserByID(solar_device.user, callback);
			},

			function(solar_device,cb){

				var token = new Buffer(sails.config.granting_token+':').toString('base64');
				console.log('the token is ');
				console.log(token);
				var project = {
					"address":solar_device.address,
					"city": solar_device.city,
					"zipCode": solar_device.zipcode,
					"state": solar_device.state,
					"country": solar_device.country,
					"nameplate": solar_device.nameplate,
					"walletAddress": solar_device.public_key,
					"documentation":"http://internalvalidation.solatchange.co/",
				};

				var data = {
					"firstName":'TEST '+solar_device.firstName,
					"lastName":'TEST '+solar_device.lastName,
					"email": solar_device.user.email,
					"projects":[project]
				};
				
				var options = {
				      //url:'http://ec2-52-34-149-46.us-west-2.compute.amazonaws.com:8080/claim',
				      url:sails.config.granting_url+'/claim',
				      headers: {Authorization: 'Basic '+token},
				      method: "POST",
				      json:true,
				      body:data
				    };

				    var callback = function(err,res,body,solar){
				    	cb(err,res,body,solar);
				    }

				request(options,function(err,httRes,body){
					console.log('submitted Solar device to Granting Machine for '+solar_device.firstName+' '+solar_device.lastName);
					if (err) console.log(err);
				 	if (err) return cb(err);
				 	console.log('Successful in registering the Solar Device');
				 	callback(null, httRes, body, solar_device);
				 });

				},


			function(httRes,body,solar_device,cb){
				Granting.create({message:body,from:'granting_machine',to:'solar_change'}).exec(function(err,created){
					if (err) return cb(err);
					return cb(null, httRes, body, solar_device);
				});
			},


			function(httRes,body, solar_device, cb){
				console.log('-----------------------')
				console.log(body)
				console.log('-----------------------')
				sails.controllers.granting.after_submission(solar_device, body, cb);
			},



			function(the_device,cb){
				var callback = function(err,found_device){
					if (err) return cb(err);
					// mailer_service.solar_device_submitted(found_device.user.email, found_device);
					return cb(null,found_device);
				};
				sails.controllers.solar_device.get_populated_device(the_device.id,callback);
			}
		],

			function(err, final_device){
				if (err){ 
					console.log(err);
					return res.json(err);
				}
				console.log('Have submitted a Solar Device to the granting Machine');
				return res.json([final_device]);
			});
	},

	after_submission: function(device,granting_response, cb){
		device.approval_history.push({event:'submitted', date:granting_response.timestamp});
		if (!device.granting_responses) device.granting_responses = [];

		device.granting_responses.push(granting_response);

		Solar_device.update({id:device.id},{granting_id:granting_response.id,
											 affiliate:granting_response.affiliate, 
											 granting_responses:device.granting_responses,
											 approval_history:device.approval_history})
		.exec(function(err,updated){
			//mailer_service.solar_device_submitted(updated[0].user.email, updated[0]);
			if (err) return cb(err);
			return cb(null, updated[0]);
		});
	},


	granting_judgement: function(req, res){
		
		console.log('Adding a granting reaction which is: '+req.body.event);

		async.waterfall([

			function(cb){
				Granting.create({message:req.body, from:'granting_machine', to:'solar_change'}).exec(function(err,created){
					if (err) return cb(err);
					return cb(null);
				})
			},

			function(cb){
				sails.controllers.solar_device.add_granting(req.body.id,req.body,req.body.timestamp,cb);
			},

			function(solar,cb){
				sails.controllers.granting.send_granting_mail(updated[0],req.body.event, req.body.detail);
				if (solar.from_bulk){
					return sails.controllers.bulk_entry.new_granting(solar,req.body,cb);
				}
				else return cb(null,solar);
			},

			],function(err,results){
				if (err) return res.send(500,err);
				return res.send(200,results);
		});


		/*
		var cb = function(err,updated){
			if (err){ 
				console.log(err);
				return res.json(err);
			}

			sails.controllers.granting.send_granting_mail(updated[0],req.body.event, req.body.detail);

			return res.json({events:updated[0].approval_history, 
				grantings:updated[0].solar_grantings,
				id:updated[0].granting_id});
		};
		sails.controllers.solar_device.add_granting(req.body.id,req.body,req.body.timestamp,cb);
		*/
	},



	send_granting_mail: function(device, event, detail){
		async.waterfall([
			function(cb){
				sails.controllers.solar_device.get_populated_device(device.id,cb);
			},

			function(device_with_user, cb){
				if (!device_with_user.user) return cb({error:'Solar Device does not have user'});
				switch(event){
					case 'approved':
						mailer_service.system_approved(device_with_user.user.email,device_with_user.user.firstName, device_with_user);
						cb(null, device_with_user);
						break;
					case 'rejected':
						var err = null;
						var reason = detail;
						if (!detail) {
							reason = 'Unknown';
							err = {error:'No reason for rejection'};
						}
						mailer_service.rejection(device_with_user.user.email, device_with_user.user.firstName,reason);
						return cb(err, device_with_user);
						break;
				}
			},
			], 
			function(err,results){
				if (err) return console.log(err);
				return console.log('Sent mail to '+results.user.email);
		});
	},


	parse_granting_reply:function(granting_reply){
		switch (granting_reply.event){
			case 'approved':
				return 'granting_approved';
				break;
			case 'rejected':
				return 'granting_rejected';
				break;
		}

	},

};

