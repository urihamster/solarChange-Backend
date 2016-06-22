/**
 * PublicKeyController
 *
 * @description :: Server-side logic for managing publickeys
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */


var request = require('request');
var http = require('http');

module.exports = {
	

  send_pk:function(req,res){
    this.get_pks_transactions(['huhuhuhuhuhuhuh'], res.json);
  },



get_blockchain_data:function(req,res){

  req.setTimeout(1000000,function () {
    req.abort();
    console.log("timeout");
    self.emit('pass',message);
  });

  var pk_arr = [req.params.pk];
  var cb = function(err, success){
    if (err) return res.json(err);
    return res.json(success);
  };

sails.controllers.public_key.get_pks_blockchain_info(pk_arr,cb);
},


  get_blockchain_history:function(pks, cb){

    var authHeader = new Buffer(sails.config.blockChainUnit.username+':'+sails.config.blockChainUnit.password).toString('base64');

    async.waterfall([

      function(callback){
        var way = 'get-info?pubKeys=';
        var begin = true;
        for (i=0; i<pks.length ; i++){
          if (begin) begin = false;
          else way = way+'|';
          way = way+pks[i];
        }

        console.log(way);

        var options = {
                  url:sails.config.blockChainUnit.url+way,
                  headers: {Authorization: 'Basic '+authHeader},
                  method: "GET",
                  json:true,
                };

        console.log('gonna send the request to bcapi')

        request(options,function(err,httRes,body){

        console.log('got the answer from bcapi <---------------')
        // console.log(body);

              if (err) return callback(err);
              return callback(null,body);

             });
      },


      function(block_res,callback){
        var cally = function(err){
          if (err) return callback(err);
          return callback(null,block_res);
        };

        console.log('gonna make sure the keys exist --------')
        sails.controllers.transaction.make_sure_pks_are_there(block_res.txs,cally);

      },


      function(block_res,callback){

        var bla = sails.controllers.public_key.get_current_balanace(block_res.txs, pks[0])
    
      console.log('now, adding TXS. the number is: : : : : : : : : : : :')

      console.log(block_res.txs.length)

      console.log(': : : : : : : : : : : : : : : : : : : : : : : : :: : : : : :')

      // REMOVE THIS AFTER
      return callback(null,{success:true});


      async.each(block_res.txs, function(a_transaction,callcall){
          sails.controllers.transaction.add_from_blockChain(a_transaction,callcall);
          },
          function(err){
            if (err) return callback(err);
            return callback(null,{success:true});
              });    


      },

      function(success, callback){

        console.log('Thi SI -----0-------------------------------------')

        var  cally = function(err,the_pks){
          if (err) return callback(err);
          return (null, success, the_pks);
        }

        Public_key.find({}).exec(function(err, found){
            if (err) return cally(err);
           var the_pks =  _.pluck(found,'key');
           return cally(null,the_pks);
        });        

      },

      ],function(err,success,the_pks){
        
        
        if (err) return cb(err);

        var options = {
                  url:sails.config.blockChainUnit.url+'set-public-keys',
                  headers: {Authorization: 'Basic '+authHeader},
                  method: "POST",
                  json:true,
                  body:the_pks
                };
                options.headers['Content-Type']='application/json';

                console.log('now sent it all' );

        request(options,function(err,httRes,body){
              if (err) return cb(err);
              return cb(null,{success:true});
             });
    });
  },

  get_current_balanace:function(txs,key){
  var amount = 0;
  var cred = 0;
  var deb = 0;
  for (var i=0; i<txs.length; i++){
    var inside_it = false
    for (var j=0; j<txs[i].recipients.length ; j++)
    {
      if (txs[i].recipients[j].publicKey==key) 
        { 
          inside_it = true;
          amount = amount+txs[i].recipients[j].amount;
          cred = cred+txs[i].recipients[j].amount;
        }
    }

    for (j=0; j<txs[i].senders.length ; j++)
    {
      if (txs[i].senders[j].publicKey==key)
      {
        inside_it = true;
        amount = amount-txs[i].senders[j].amount;   
        deb=deb+txs[i].senders[j].amount;    
      }
    }

   //  if (!inside_it) console.log('WIIIIIIIWOOOOOOO NOT INSIDE THE TRANSACTioN YO YO YO YO YO YO YO YO OY YOY OY OYO YO YOY ')
  }

  return amount;

  },


  add_key: function(req, res){

    req.setTimeout(1000000,function () {
      req.abort();
      console.log("timeout");
      self.emit('pass',message);
    });

    async.waterfall([

      function(cb){
        Public_key.findOne({key:req.body.key}).populate('user').exec(function(err,found){
          if (err) return cb(err);
          console.log('done the 1 1 1 '+req.body.key)
          return cb(null,found);
        });
      },

      function(found,cb){

        console.log('done the 2 2 2 '+ req.body.key);

        if (found){
          if (found.user.id){
            return cb({error:'This Key Belongs to another user'});
          }

          Public_key.update({key:req.body.key},{user:req.headers.sender}).exec(function(err,updated){
            if (err) return cb(err);
            return cb(null,updated);
          });
        }
        else {
          var to_create={};
          to_create.key = req.body.key;
          to_create.user = req.headers.sender;
          Public_key.create(to_create).exec(function(err, created){
             if (err) return cb(err);
             console.log('created the key '+req.body.key)
             return cb(null,created);
          });
        }
      },

      function(created, cb){

        console.log('done the 3 3 3 '+req.body.key);

          var callback = function(err, success){
            if (err) return cb(err);
            return cb(null,created,success);
          };

          console.log('gonna get the blockchain history ---->>>>>>>>><<<<<<<<')
         sails.controllers.public_key.get_blockchain_history([created.key],callback);
      },

      function(created, success, cb){

        console.log('done the 4 4 4 '+req.body.key)
        if (success){
          Public_key.update({key:created.key},{blockchain_status:'confirmed'}).exec(function(err,updated){
            if (err) return cb(err);
            return cb(null,updated);
          });
        }
        else return cb({error:'could not get data from blockchain'});
      }

      ],

      function(err,created){
        console.log('got to the last thing and gonna end it -- '+req.body.key)
        if (err) return sails.controllers.public_key.make_sure_for_twice(req, res, err);
          ///res.json(err);
        return res.json(created);
      })
  },


  make_sure_for_twice: function(req, res, original_err){
      Public_key.findOne({key:req.body.key}).populate('user').exec(function (err, found) {
          if (err) return res.json(err);
          
          if (found.user){
            if (found.user.id == req.headers.sender) return res.json(found);
          }

         return res.json(original_err);
        });
  },



  add_from_solar_device: function(key, device_id,user_id,cb){

    async.waterfall([
      function(callback){
        Public_key.findOrCreate({key:key},{key:key, user:user_id},function(err,pk){
          if (err) return cb(err);

          Public_key.update({key:key},{solar_device:device_id}).exec(function(err,updated){
            if (err) return cb(err);
            return callback(null, updated);
          });
        });
      },

      function(key_object,callback){
            if (key_object.blockchain_status=='unconfirmed'){
            async.waterfall([
              function(callcall){
              var cally = function(err,success){
                if (err) return callback(err);
                return callback(null,key_object)
              };
              sails.controllers.public_key.get_blockchain_history([updated.key], cally);
              }
              ],
              function(err,the_key){
                Public_key.update({key:key_object.key},{blockchain_status:'confirmed'}).exec(function(err,updated){
                  if (err) return callback(err);
                  return callback(null,updated);
                });
               });
           }
            else return callback(null,key_object);
      }

      ],
      function(err,key_object){
        if (err) return cb(err);
        return cb(null,key_object);
      });
   
  },

  make_sure_created: function(pk_ar,cb){

    pk_ar = _.uniq(pk_ar);

    //console.log(pk_ar);

    console.log('i am now making sure that the keys are actually there ')
    console.log(pk_ar.length)

    async.each(pk_ar,function(pk,callback){
      Public_key.findOrCreate({key:pk},{key:pk, user:null, currentValue:null, blockchain_status:'external'}).exec(function(err, created){

       // console.log('looking at a key now >>>>>>>>>>-----------+++++++++')

        if (err) return callback(err);
        return callback(null,created);
      });
    },function(err){
      if (err) console.log(err)
      if (err) return cb(err);
      console.log('THis is finally OVER')
      return cb(null);
    });
  },



  add_txs:function(tx_id,keys,to_from, cb){

  if (to_from=='to') var cred_deb = 'credits';
  else var cred_deb = 'debits';

    var search_obj = [];
    for (var i =0 ; i<keys.length ; i++){
      search_obj.push({key:keys[i]});
    }
  
      Public_key.find({or:search_obj}).populate(cred_deb).exec(function(err,found){
        if (err) return cb(err);

        async.each(found,function(wallet,callback){
          wallet[cred_deb].add(tx_id);
          wallet.save(function(err,saved){
            if (err) return callback(err);
            return callback(null);
          });
        },

          function(err){
            if (err) return cb(err);
            return (cb(null,found));
        });
      });
  },
  

  get_populated_pk:function(key,cb){
      Public_key.findOne({key:key}).populate('debits').populate('credits').exec(function(err,found){
        if (err) return cb(err);
        return cb(null,found);
      });
  },

  get_populated_organization: function(key, cb){
    Public_key.findOne({key:key}).populate('organization').exec(function(err,found){
        if (err) return cb(err);
        return cb(null,found);
      });
  },

  get_populated_organization_user: function(key, cb){
    Public_key.findOne({key:key}).populate('user').populate('organization').exec(function(err,found){
        if (err) return cb(err);
        return cb(null,found);
      });
  },

  get_known: function(req, res){
    if (!req.isSocket) {
          return res.badRequest('Only a client socket can subscribe to Louies.  You, sir or madame, appear to be an HTTP request.');
      }
    Public_key.find({known:true}).populate('organization').exec(function(err, found){
      if (err) return res.serverError(err);

      Public_key.subscribe(req, _.pluck(found,'key'));
        return res.json(found);
    });
  },


  add_known: function(req, res){
     if (!req.isSocket) {
          return res.badRequest('Only a client socket can use this function.  You, sir or madame, appear to be an HTTP request.');
      }

      async.waterfall([

        function(cb){
          Public_key.findOne({key:req.body.key}).exec(function(err,found){
            if (err) return cb(err);
            return cb(null, found);
          });
        },

        function(found, cb){
          if (found){
            Public_key.update({key:found.key},{known:true, organization:req.body.org}).exec(function(err, updated){
              if (err) return cb(err);
              return cb(null,updated);
            });
          }
          else{
            Public_key.create({key:req.body.key, known:true, organization:req.body.org}).exec(function (err,created){
              if (err) return cb(err);
              return cb(null, created);
            })
          }
        },

        ], 
        function(err, result){
          if (err) return res.json(err);
          return res.json(result);
      })
  },


  /**
   * `PublicKeyController.newPrime()`
   */
  newPK: function (keyString, user, cb) {
  	
  	var theUser = user || null;

  	Public_key.create({key:keyString, user:theUser}).exec(function afterPKCreation(err, created){
  		if (err) return cb(err);
  		cb(null, created);
  	});
  },

destroy_keys:function(req,res){
  Public_key.destroy({}).exec(function(err){
    res.json('YEAAAAH')
  });
},


destroy_known: function(req, res) {
  Public_key.destroy({known:true}).exec(function (err) {
    res.json('known dead ')
  })
}

};

