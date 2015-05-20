const st = require('node-static');
const file = new st.Server('./');

require('http').createServer(function (request, response) {
  request.addListener('end', function () {
    file.serve(request, response);
  }).resume();
}).listen(4001);

console.log('Serving file on http://localhost:4001');
