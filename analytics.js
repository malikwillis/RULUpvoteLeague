// Vercel Web Analytics
// This script initializes Vercel Web Analytics for the application
// For vanilla HTML/JS projects, we use the window.va approach
(function() {
  window.va = window.va || function () { 
    (window.vaq = window.vaq || []).push(arguments); 
  };
  
  // Load the Vercel Analytics script
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);
})();
