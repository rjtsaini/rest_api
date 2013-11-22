jQuery(document).ready(function () {

  var demos = [];
  jQuery('.demo').each(function (idx, el) {
    var demo = jQuery(el);
    var anchor = demo.find('.demo-link').attr('name');
    var title = demo.find('.title').text();
    demos.push("<li><a href='#" + anchor + "'>" + title + "</a></li>");
  });
  jQuery('#toc').html("<ul>" + demos.join("") + "</ul>");


  // copy all the source to the corresponding syntax highlight block for highlight.  Doing a copy/paste
  // here allows me to have a single source.
  jQuery('.demo-code-block').each(function (idx, el) {
    var id = el.id.substring("demo-code-block".length);
    var target = "demo-code-display" + id;
    jQuery('#' + target).html('<![CDATA[' + jQuery(el).html() + ']]>');
  });

  // after copying all the source to the display blocks, highlight them.
  SyntaxHighlighter.all();
});
