const http = require('http');
const fs = require('fs'); // File system module to read HTML file

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' }); // Set content type to HTML
  fs.readFile('index.html', (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Error: File not found');
    } else {
      res.end(data); // Send the HTML content
    }
  });
});

const port = 8000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});