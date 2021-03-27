if (typeof btoa === 'undefined') {
  global.btoa = function btoa(str) {
    return Buffer.from(str, 'utf8').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function atob(str) {
    return Buffer.from(str, 'base64').toString('utf8');
  };
}
