import * as sapper from '@sapper/app';

sapper.start({
	target: document.querySelector('#sapper')
});

window.addEventListener('activate', function(event) {
	debugger;
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          // Return true if you want to remove this cache,
          // but remember that caches are shared across
          // the whole origin
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});