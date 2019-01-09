var TemplateConfig, sysmo;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
sysmo = (typeof require === "function" ? require('sysmo') : void 0) || (typeof window !== "undefined" && window !== null ? window.Sysmo : void 0);
TemplateConfig = (function() {
  function TemplateConfig(config) {
    this.applyFormatting = __bind(this.applyFormatting, this);
    this.aggregate = __bind(this.aggregate, this);
    this.processable = __bind(this.processable, this);
    this.getValue = __bind(this.getValue, this);
    this.getKey = __bind(this.getKey, this);
    this.getPath = __bind(this.getPath, this);    config.path || (config.path = '.');
    config.as || (config.as = {});
    if (sysmo.isString(config.choose)) {
      config.choose = [config.choose];
    }
    if (sysmo.isString(config.include)) {
      config.include = [config.include];
    }
    this.arrayToMap = !!config.key;
    this.mapToArray = !this.arrayToMap && config.key === false && !config.as;
    this.directMap = !!(this.arrayToMap && config.value);
    this.nestTemplate = !!config.nested;
    this.includeAll = !!config.all;
    this.ensureArray = !!config.ensureArray;
    this.ignoreEmpty = config.ignoreEmpty !== false;
    this.config = config;
  }
  TemplateConfig.prototype.getPath = function() {
    return this.config.path;
  };
  TemplateConfig.prototype.getKey = function(node) {
    switch (sysmo.type(this.config.key)) {
      case 'Function':
        return {
          name: 'value',
          value: this.config.key(node)
        };
      default:
        return {
          name: 'path',
          value: this.config.key
        };
    }
  };
  TemplateConfig.prototype.getValue = function(node, context) {
    switch (sysmo.type(this.config.value)) {
      case 'Function':
        return {
          name: 'value',
          value: this.config.value(node)
        };
      case 'String':
        return {
          name: 'path',
          value: this.config.value
        };
      default:
        return {
          name: 'template',
          value: this.config.as
        };
    }
  };
  TemplateConfig.prototype.processable = function(node, value, key) {
    var path, paths, _i, _len, _ref;
    if (!this.config.choose && this.includeAll) {
      return true;
    }
    if (!this.config.choose && !this.paths) {
      this.paths = [];
      _ref = this.config.as;
      for (key in _ref) {
        value = _ref[key];
        if (sysmo.isString(value)) {
          this.paths.push(value.split('.')[0]);
        }
      }
    }
    if (sysmo.isArray(this.config.choose)) {
      paths = this.paths || [];
      paths = paths.concat(this.config.choose);
      for (_i = 0, _len = paths.length; _i < _len; _i++) {
        path = paths[_i];
        if (path.split('.')[0] === key) {
          return true;
        }
      }
      return false;
    }
    if (!sysmo.isFunction(this.config.choose)) {
      return !!(this.includeAll || this.directMap);
    } else {
      return !!this.config.choose.call(this, node, value, key);
    }
  };
  TemplateConfig.prototype.aggregate = function(context, key, value, existing) {
    var aggregator, _ref;
    aggregator = ((_ref = this.config.aggregate) != null ? _ref[key] : void 0) || this.config.aggregate;
    if (!sysmo.isFunction(aggregator)) {
      return false;
    }
    context[key] = aggregator(key, value, existing);
    return true;
  };
  TemplateConfig.prototype.applyFormatting = function(node, value, key) {
    var formatter, pair, _ref;
    if (!sysmo.isNumber(key)) {
      formatter = ((_ref = this.config.format) != null ? _ref[key] : void 0) || this.config.format;
      pair = sysmo.isFunction(formatter) ? formatter(node, value, key) : {};
    } else {
      pair = {};
    }
    if (!('key' in pair)) {
      pair.key = key;
    }
    if (!('value' in pair)) {
      pair.value = value;
    }
    return pair;
  };
  return TemplateConfig;
})();
if (typeof module !== "undefined" && module !== null) {
  module.exports = TemplateConfig;
} else {
  window.json2json || (window.json2json = {});
  window.json2json.TemplateConfig = TemplateConfig;
}