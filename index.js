const config     = require('./config');
const express    = require('express');
const bodyParser = require('body-parser');
const twilio     = require('twilio');
const ngrok      = require('ngrok');

const app = new express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/token/:identity', (request, response) => {
  const identity = request.params.identity;
  const accessToken = new twilio.jwt.AccessToken(config.twilio.accountSid, config.twilio.apiKey, config.twilio.apiSecret);
  const chatGrant = new twilio.jwt.AccessToken.ChatGrant({
    serviceSid: config.twilio.chatServiceSid,
  });
  accessToken.addGrant(chatGrant);
  accessToken.identity = identity;
  response.set('Content-Type', 'application/json');
  response.send(JSON.stringify({
    token: accessToken.toJwt(),
    identity: identity
  }));
})

app.listen(config.port, () => {
  console.log(`Application started at localhost:${config.port}`);
});


// ============================================
// ============================================
// ====== HANDLE NEW-CONVERSATION HOOK ========
// ============================================
// ============================================
let client = new twilio(config.twilio.accountSid, config.twilio.authToken);

app.post('/chat', (req, res) => {
  console.log("Received a webhook:", req.body);
  if (req.body.EventType === 'onConversationAdded') {
    const me = "Select";
    client.conversations.v1.conversations(req.body.ConversationSid)
      .participants
      .create({
          identity: me
        })
      .then(participant => console.log(`Added ${participant.identity} to ${req.body.ConversationSid}.`))
      .catch(err => console.error(`Failed to add a member to ${req.body.ConversationSid}!`, err));
  }

  console.log("(200 OK!)");
  res.sendStatus(200);
});

app.post('/outbound-status', (req, res) => {
  console.log(`Message ${req.body.SmsSid} to ${req.body.To} is ${req.body.MessageStatus}`);
  res.sendStatus(200);
})

app.get('/mailchimp', (req, res) => {
  console.log("Received Mailchimp webhook: ", req.body);
  res.send("Hello World");
})

//When MC gets a new subscriber
app.post('/mailchimp', (req, res) => {
  console.log("Received Mailchimp webhook: ", req.body);
  // console.log(req.body.data.merges.PHONE);
  const me = "Select";
  var subscriber_name = req.body.data.merges.FNAME + " " + req.body.data.merges.LNAME;
  // console.log(subscriber_name);
  // Create Conversation
  client.conversations.conversations
      .create({
         messagingServiceSid: config.twilio.messagingServiceSid,
         friendlyName: subscriber_name
       })
       //Create Participant for New Subscriber and Add to Convo
      .then(conversation => {
        console.log(conversation);
        client.conversations.conversations(conversation.sid)
          .participants
          .create({
              'messagingBinding.address': `${req.body.data.merges.PHONE}`,
              'messagingBinding.proxyAddress': config.twilio.proxy
            })
          //Add "Select" Identity
          .then(participant => {
            console.log(participant);
            client.conversations.conversations(conversation.sid).participants
            .create({
              identity: me
            })
            //Send 1st Message
            .then(participant => {
              console.log(`Added ${participant.identity} to ${conversation.sid}.`);
              client.conversations.conversations(conversation.sid)
                    .messages
                    .create({author: me, body: 'Hey, this is Kumar Mahaboob'})
                    .then(message => console.log(message.sid))
                    .catch(e => console.log(e));
            })
            .catch(err => console.error(`Failed to add a member to ${req.body.ConversationSid}!`, err));
          })
          .catch(e => console.log(e));
      });
  res.sendStatus(200);
})


var ngrokOptions = {
  proto: 'http',
  addr: config.port
};

if (config.ngrokSubdomain) {
  ngrokOptions.subdomain = config.ngrokSubdomain
}

// ngrok.connect(ngrokOptions).then(url => {
//   console.log('ngrok url is ' + url);
// }).catch(console.error);
