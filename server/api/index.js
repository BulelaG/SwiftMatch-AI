// Vercel serverless entrypoint: every request is rewritten here (see ../vercel.json)
// and handled by the same Express app that runs locally with `node server.js`.
module.exports = require('../server.js');
