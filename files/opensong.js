/******************************************************************************
 * OpenSong - Open Source Lyrics Projection                                    *
 * --------------------------------------------------------------------------- *
 aangepast voor OpenSong, aug 2014 CRB                                     
 ontleend aan
 
 * OpenLP - Open Source Lyrics Projection    * Copyright (c) 2008-2013 Raoul Snyman                                        *

 ******************************************************************************/

$.support.cors = true;

var OpenSongHost;
var lastMode = '';    // N = normal, B = black, F = freeze, H = hide, X = other, S = sleep
var lastSectie = -1;
var lastSlide = -1;
var currentSectie = -1;
var currentSlide = -1;
var Playlist;
var sok;
var loadServiceBusy;
var loadControllerBusy;
var updateStatusBusy;
var lastUrl;

if (localStorage["OpenSongHost"] === null) {
  localStorage["OpenSongHost"] = '127.0.0.1';
  localStorage["OpenSongPort"] = '8082';
  localStorage["OpenSongPwd"] = '';
}
OpenSongHost = 'ws://' + localStorage["OpenSongHost"] + ':' + localStorage["OpenSongPort"] + '/ws';

if (localStorage["OpenSongtekstSize"] === null) {
  localStorage["OpenSongtekstSize"] = '30';
}

function make_base_auth(password) {
  var hash = btoa(password);
  return "Basic " + hash;
}

window.OpenSong = {
  getElement: function(event) {
    var targ;
    if (!event) {
      var event = window.event;
    }
    if (event.target) {
      targ = event.target;
    }
    else if (event.srcElement) {
      targ = event.srcElement;
    }
    if (targ.nodeType == 3) {
      // defeat Safari bug
      targ = targ.parentNode;
    }
    return $(targ);
  },
  loadService: function (event) {
    // service is de hele liturgie
    if (event) {
      event.preventDefault();
    }
    if (loadServiceBusy == true) {
       return false;
    }
    loadServiceBusy = true;
    $.ajax({
      type: "GET",
      url: OpenSongHost + "presentation/slide/list",
      dataType: "xml",
//      async : false,
      success: function (xmlPlaylist) {
          Playlist = xmlPlaylist;
          // voeg sectienummer toe aan playlist
          vorige = 'xxxxxxxxx';
          vorigesoort = '';
          var i = 1;
          $(Playlist).find('response').children().each(function() {
             if ($(this).attr('identifier')) {
                var name = $(this).attr('name');
                var soort = $(this).attr('type');
                if ((name != vorige) || (soort != vorigesoort)) {
                  i++;
                }
                $(this).attr('sectie',i);
                vorige = name;
                vorigesoort = soort;
             }
          });

          var s = 1;   // tel songs
          var ul = $("#service-manager > div[data-role=content] > ul[data-role=listview]");
          ul.html("");
          vorige = 'xxxxxxxxx';
          vorigesoort = '';
          i = 1;  // tel secties
          $(xmlPlaylist).find('response').children().each(function(){
            if ($(this).attr('identifier')) {
              // dit slaat slides zonder identifier over (meestal stylesheets)
              var n = $(this).attr('identifier');  // 
              var name = $(this).attr('name');
              var soort = $(this).attr('type');
              if ((name != vorige) || (soort != vorigesoort)) {
                var title = $(this).find('title').text();
                if (soort == 'song') {
                  var li = $("<li data-icon=\"false\">").append(
                  $("<a href=\"#\">").attr("slide",n).attr("song", parseInt(s, 10)).text(name ));
                  s++;
                } else {
                  var li = $("<li data-icon=\"false\">").append(
                  $("<a href=\"#\">").attr("slide", parseInt(n, 10)).text(name));
                }
                i++;
                li.attr("slide",n);
                li.attr("sectie",i);
                li.children("a").click(OpenSong.setSectie);
                ul.append(li);
                vorige = name;
                vorigesoort = soort;
              }
              n++;
            }
          });  // einde each function
          if (ul.haschildren) {
            ul.listview().listview("refresh");
          }
          loadServiceBusy = false;
          OpenSong.showService();
        }  // einde succes function  
    });   // einde ajax
  },
  showService : function () {
    var ip = 0;
    var ih = 0;
    if (currentSectie == 0) {
      n = $(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie');
    } else {
      n = currentSectie;
    }
    $("#service-manager div[data-role=content] ul[data-role=listview] .ui-btn-e").removeClass("ui-btn-e").addClass("ui-btn ui-btn-c");
    $("#service-manager div[data-role=content] ul[data-role=listview] li").each(function () {
      var item = $(this);
      var dezeSectie = item.attr("sectie");  
      if (dezeSectie == n ) {
        item.find('a').removeClass("ui-btn-c").addClass("ui-btn ui-btn-e");
        ip = item.offset().top;
        ih = item.height();
        return false;
      }
    });
    try {
      $("#service-manager div[data-role=content] ul[data-role=listview]").listview("refresh");
      var wh = $(window).height() - 100;
      var ws = $(window).scrollTop();
      if (((ip + ih - ws) > wh ) || ((ip-ih-ih) < ws)) {
        $.mobile.silentScroll(ip-wh/2);
      }
    }
    catch(e){
//      alert('An error has occurred: '+e.message)
    }
  },
  loadController: function () {
    if (currentSectie == lastSectie) {
      return;
    }
    if (loadControllerBusy == true) {
      return false;
    }
    lastSectie = currentSectie;
    var lastpresentid = '';
    var sn = currentSlide;
    var ul = $("#slide-controller > div[data-role=content] > ul[data-role=listview]");
    ul.html("");
    soort  = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').attr('type');
    if (soort == 'blank') {
      $("#controller-titel").text("(slide: " + sn + "; item: " + currentSectie + ")");
      var li = $("<li data-icon=\"false\">").append(
        $("<a href=\"#\">").attr("slide",sn).html(''));
      li.children("a").click(OpenSong.setSlide);
      ul.append(li);
      sn++;
    } else {
      loadControllerBusy = true;
      var i = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').attr('sectie');
      // lees nu alle slides in die in deze sectie horen
      $(Playlist).find('response').find('slide').each( function() {
      if ($(this).attr("sectie") == i) {
        // maak een lege li lijst
        var s = $(this).attr('identifier');
        vers = "0";
        tekst = i18n.t("setup.dia4");
        var li = $("<li data-icon=\"false\">").append(
                $("<a href=\"#\">").attr("slide", parseInt(s, 10)).attr('vers',vers).html(tekst));
        li.children("a").click(OpenSong.setSlide);
        ul.append(li);
        lastUrl = OpenSongHost + "presentation/slide/" + s;
        $.ajax({
          type: "GET",
          url: OpenSongHost + "presentation/slide/" + s,
          dataType: "xml",
          success: function (xmlSong) {
            if ($(xmlSong).find('response').find('slide').attr('name')) {
              naam = $(xmlSong).find('response').find('slide').attr('name');
            } else {
              naam = '';
            };
            slideId = $(xmlSong).find('response').attr('identifier');
            tekst = $(xmlSong).find('response').find('slide').find('title').text();
            verzen = $(xmlSong).find('response').find('slide').find('presentation').text();
            if (tekst != '') {
              if (verzen != '') {
                verzen = verzen.replace(/V/gi, '');
                verzen = verzen.replace(/C/gi, 'refr.');
                verzen = verzen.replace(/ /g, ', ');
                $("#controller-titel").text(tekst + ": " + verzen);
              } else {
               $("#controller-titel").text(tekst);
              }
            } else {
              if (naam != '') {
                $("#controller-titel").text(naam);
              } else {
                $("#controller-titel").text("(slide: " + currentSlide + "; item: " + currentSectie + ")");
              }
            }
            var soort = $(xmlSong).find('response').find('slide').attr('type');
            $(xmlSong).find('response').find('slide').find('slides').find('slide').each(function() {
              var tekst = $(this).find('body').text();
              if (soort == 'image') {
                var bestand = $(xmlSong).find('response').find('slide').find('filename').text();
                tekst = tekst + i18n.t("setup.dia3") + ': ' + bestand.replace(/^.*[\\\/]/, '');
                if ($('#regelaarsoort-a').is(":checked")) {
                  tekst = '<img src="' + OpenSongHost + 'presentation/slide/' + slideId
                    + '/preview/width:160/height:100" align="right">' + tekst;
                }
              }
              if (soort == 'external') {
                var app = $(xmlSong).find('response').find('slide').attr('application');
                var bestand = $(xmlSong).find('response').find('slide').attr('filename');
                bestand = bestand.replace(/^.*[\\\/]/, '');
                var desc = $(this).find('description').text();
                tekst = tekst + '(' + app + ') ' + desc + ' - ' + bestand;
              }
              tekst = tekst.replace(/\n/g, '<br />');
              if (soort == 'song') {
                if ($(this).attr('id')) {
                  var vers = $(this).attr('id');
                  verst = vers.replace(/V/gi, '');
                  verst = verst.replace(/C/gi, 'refr');
                    tekst = '<sup>' + verst + '. </sup>' + tekst;
                }
              }
              if ($('#regelaarsoort-b').is(":checked")) {
                // voeg thumb toe
                tekst = tekst + '<p class="ui-li-aside"><img src="' + OpenSongHost + 'presentation/slide/' + slideId
                    + '/preview/width:160/height:100"></p>';   
              }
              if ($('#regelaarsoort-c').is(":checked")) {
                // toon alleen plaatje
                tekst = '<img src="' + OpenSongHost + 'presentation/slide/' + slideId
                    + '/preview/width:480/height:300">';   
              }
              // vul nu de li lijstitem met de opgehaalde gegevens
              $("#slide-controller div[data-role=content] ul[data-role=listview] li a").each(function () {
                var item = $(this);
                if (item.attr("slide") == slideId) {
                  item.attr('vers',vers).html(tekst);
                  return false;
                }
              });
            })
            // ajax call is klaar, nu showController aanroepen
            OpenSong.showController();
          } // ajax succes function
        })   // ajax
              s++;
              sn = s;
      } // deze sectie
    }); //each function
    } // if soort is blank
    // voeg de 2 items toe die hierna komen
    if ($(Playlist).find('response').find('slide[identifier="' + sn + '"]')) {
      titel = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').find('title').text();
      naam = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').attr('name');
      var s = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').attr('identifier');
      if (naam != titel) {
        titel = '(' + naam + ') ' + titel;
      }
      var li = $("<li data-icon=\"false\">").append(
        $("<a href=\"#\">").attr("slide",s).html(i18n.t("nav.next") + ': ' + titel));
      li.children("a").click(OpenSong.setSlide);
      ul.append(li);
      var i = $(Playlist).find('response').find('slide[identifier="' + sn + '"]').attr('sectie');
      i++;
      $(Playlist).find('response').find('slide').each( function() {
        if ($(this).attr('sectie') == i) {
          titel = $(this).find('title').text();
          naam = $(this).attr('name');
          if (naam != titel) {
            titel = '(' + naam + ') ' + titel;
          }
          var s = $(this).attr('identifier');
          var li = $("<li data-icon=\"false\">").append(
            $("<a href=\"#\">").attr("slide",s).html(i18n.t("nav.then") + ': ' + titel));
          li.children("a").click(OpenSong.setSlide);
          ul.append(li);
          return false;
        }
      })
    }
    ul.listview().listview("refresh");
    // showcontroller kan nu nog niet lopen omdat alle ajax calls nog niet terug zijn
    OpenSong.showController();
    loadControllerBusy = false;
  },
  showController : function () {
    var ip;
    var ih;
          $("#slide-controller div[data-role=content] ul[data-role=listview]  .ui-btn-e").removeClass("ui-btn-e").addClass("ui-btn");
          $("#slide-controller div[data-role=content] ul[data-role=listview] a").each(function () {
            var item = $(this);
            if (item.attr("slide") == currentSlide.toString()) {
              item.removeClass("ui-btn-c").addClass("ui-btn-e");
              item = item.parent();
              ip = item.offset().top;
              ih = item.height();
              return false;
            }
          });
          $("#slide-controller div[data-role=content] ul[data-role=listview]").listview("refresh");
          var wh = $(window).height() - 100;
          var ws = $(window).scrollTop();
          if (((ip + ih - ws) > wh ) || ((ip-ih-ih) < ws)) {
             $.mobile.silentScroll(ip-wh/2);
          }
  },
  showRemoteScreen : function () {
    if (($('#screensoort-a').is(":checked")) && (lastMode != 'B')) {
      // zwarte letters op wit scherm
      $("#remote-screen").removeClass("ui-page-theme-a").addClass("ui-page-theme-c")
    } else {
      // witte letters op zwart scherm of plaatje op zwart scherm
      $("#remote-screen").removeClass("ui-page-theme-c").addClass("ui-page-theme-a")
    }

    if ((lastMode == 'N') || ($('#screensoort-c').is(":checked"))) {
      var sn = currentSlide;
      var tsize = $("#screen-size").val();
      lastUrl = OpenSongHost + "presentation/slide/" + sn;
      //$("#current-screen-titel").html('Slideno: ' + sn);
        $.ajax({
          type: "GET",
          url: lastUrl,
          dataType: "xml",
          success: function (xmlSong) {
            tekst = $(xmlSong).find('response').find('slide').find('title').text();
            verzen = $(xmlSong).find('response').find('slide').find('presentation').text();
            if (tekst != '') {
              if (verzen != '') {
                verzen = verzen.replace(/V/gi, '');
                verzen = verzen.replace(/C/gi, 'refr.');
                verzen = verzen.replace(/ /g, ', ');
                $("#current-screen-titel").text(tekst + ": " + verzen);
              } else {
               $("#current-screen-titel").text(tekst);
              }
            } else {
              $("#current-screen-titel").text("");
            }
            // $("#current-screen-titel").css('font-size',(tsize * 0.6) + 'px');
            var soort = $(xmlSong).find('response').find('slide').attr('type');
            $(xmlSong).find('response').find('slide').find('slides').find('slide').each(function() {
              var tekst = $(this).find('body').text();
              
              if ((soort == 'image') || ($('#screensoort-c').is(":checked"))) {
                //var ww = $(window).width() -25;
                //var wh = ww * 9 / 16;
                //tekst = '<img src="' + OpenSongHost + 'presentation/slide/' + sn + '/preview/width:' + ww + '/height:' + wh + '/quality:70">';   
                tekst = '<img src="' + OpenSongHost + 'presentation/slide/current/image/' + Math.random() + '">';   
              }
              
              if (soort == 'external') {
                var app = $(xmlSong).find('response').find('slide').attr('application');
                var bestand = $(xmlSong).find('response').find('slide').attr('filename');
                bestand = bestand.replace(/^.*[\\\/]/, '');
                var desc = $(this).find('description').text();
                tekst = tekst + '(' + app + ') ' + desc + ' - ' + bestand;
              }
              tekst = tekst.replace(/\n/g, '<br />');
              
              if (soort == 'song') {
                if ($(xmlSong).attr('id')) {
                  var vers = $(xmlSong).attr('id');
                  verst = vers.replace(/V/gi, '');
                  verst = verst.replace(/C/gi, 'refr');
                  presentid = $(this).attr('PresentationIndex');
                  if (presentid != lastpresentid) {
                    tekst = '<sup>' + verst + '. </sup>' + tekst;
                    lastpresentid = presentid;
                  }
                }
              }
              $("#current-screen-tekst").css('font-size',tsize + 'px').html(tekst);
            })
          } // ajax succes function
      })   // ajax
    } else {
      if (lastMode != 'F') {
        $("#current-screen-titel").text(' ');
        $("#current-screen-tekst").html('');
      }
    }
  },
  doeAktie: function(soort,opdracht) {
    lastUrl = OpenSongHost + opdracht;
    if (localStorage["OpenSongPwd"] != '' ) {
      $.ajax({
        type: "POST",
        url: OpenSongHost + opdracht,
        crossDomain : true,
        dataType: soort,
        headers : {
          Authorization : make_base_auth(localStorage["OpenSongPwd"]) 
        },
        xhrFields: {
          withCredentials: true
        },
        succes: function (antwoord) {
          $("#host-status2").html('last Ajax response: ' + antwoord);
        }
      });
    } else {
      $.ajax({
        type: "POST",
        url: OpenSongHost + opdracht,
        crossDomain : true,
        dataType: soort,
        succes: function (antwoord) {
          $("#host-status2").html('last Ajax response: ' + antwoord);
        }
      });
    }
  },
  setSectie: function (event) {
    event.preventDefault();
    var slide = OpenSong.getElement(event);
    var slideno = slide.attr("slide");
    OpenSong.doeAktie("text","presentation/slide/" + slideno);
    $( "body" ).pagecontainer( "change", "#slide-controller");
  },
  setSlide: function (event) {
    event.preventDefault();
    var slide = OpenSong.getElement(event);
    var slideno = slide.attr("slide");
    OpenSong.doeAktie("text","presentation/slide/" + slideno);
  },
  updateStatus: function (data) {
    if (data == 'OK') { return };
    if (updateStatusBusy == true) {
        return false;
      }
      updateStatusBusy = true;
      parser=new DOMParser();
      xml=parser.parseFromString(data,"text/xml");
      if ($(xml).find('response').find('presentation').attr('running') == "1") {
        $("#host-status").html(i18n.t("setup.net2"));
//        if ($("#setup").is(":visible")) {
//    $( "body" ).pagecontainer( "change", "#service-manager");
//        }
        if ($(xml).find('response').find('presentation').find('slide').attr('itemnumber')) {
          currentSlide = $(xml).find('response').find('presentation').find('slide').attr('itemnumber');
        }
        if ($(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie')) {
          currentSectie = $(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie');
        } else {
          currentSectie = 0;
        }
        var currentMode = $(xml).find('response').find('presentation').find('screen').attr('mode');
      } else {
        // geen lopende presentatie
        if ((typeof sok != 'undefined') && (sok.readyState == 1)) {
          $("#host-status").html('<strong>' + i18n.t("setup.net6") + '</strong> (' + i18n.t("setup.net2") + ')');
        } else {
          $("#host-status").html('<strong>' + i18n.t("setup.net6") + '</strong> (' + i18n.t("setup.net7") + ')');
        }
        currentMode = "X";
        playlist = '';
        lastStatus = '';
        lastMode = '';
        lastSectie = -1;
        lastSlide = -1;
        currentSectie = -1;
        currentSlide = -1;
        loadServiceBusy = false;
        loadControllerBusy = false;
        updateStatusBusy = false;
        $( "body" ).pagecontainer( "change", "#setup");
      } // else if running == 1
        var modeChange = 0;
        if (currentMode != lastMode) { modeChange = 1; }
        lastMode = currentMode;

        // knoppen altijd zetten
        $(".status-show").removeClass("ui-btn-c ui-btn-c").addClass("ui-btn-b");
        $(".status-zwart, .status-freeze, .status-theme").removeClass("ui-btn-c ui-btn-e").addClass("ui-btn-b");
        // afjankelijk van status juiste knop aan zetten
        switch (currentMode) {
          case 'N' :
            $(".status-show").removeClass("ui-btn-b").addClass("ui-btn-c");
            break;;
          case 'B' :
            $(".status-zwart").removeClass("ui-btn-b").addClass("ui-btn-e");
            break;;
          case 'F' :
            $(".status-freeze").removeClass("ui-btn-b").addClass("ui-btn-e");
            break;;
          case 'H' :
            $(".status-theme").removeClass("ui-btn-b").addClass("ui-btn-e");
            break;;
        }
//      }; // if current mode != lastmode
      if (currentMode != "X") {
        if (lastSlide == -1) {
            OpenSong.loadService();   
        }
        if ($("#service-manager").is(":visible")) {
          if ((lastSlide != currentSlide) && (currentSlide > 0)) {
            OpenSong.showService();
          }
        };
        if ($("#slide-controller").is(":visible")) {
          if ((lastSectie == -1) || (lastSectie != currentSectie)) {
            OpenSong.loadController(currentSlide);
            OpenSong.showController(currentSlide);
          }
          if ((lastSlide != currentSlide) && (currentSlide > 0)) {
            OpenSong.showController(currentSlide);
          }
        }
        if ($("#remote-screen").is(":visible")) {
          if ( (modeChange > 0) || ((lastSlide != currentSlide) && (currentSlide > 0))) {
            OpenSong.showRemoteScreen(currentSlide);
          }
        }
      } // if currentMode != "X"
      lastSlide = currentSlide;
      updateStatusBusy = false;
  },
  nextItem: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/section/next");
  },
  previousItem: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/section/previous","");
  },
  nextSlide: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/slide/next","");
  },
  previousSlide: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/slide/previous","");
  },
  blankDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_black","");
  },
  themeDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_hide","");
  },
  freezeDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_freeze","");
  },
  showDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/normal","");
  },
  setHost: function (event) {
    typeof event !== 'undefined' ? event.preventDefault() : false;
    if ((typeof sok != 'undefined') && (sok.readyState == 1)) {
      // connectie is open, eerst sluiten
      sok.close();
    }
    OpenSongHost = 'http://' + $("#set-host").val() + ':' + $("#set-port").val() + '/';
    OpenSongWs = 'ws://' + $("#set-host").val() + ':' + $("#set-port").val() + '/ws';
    localStorage["OpenSongHost"] = $("#set-host").val();
    localStorage["OpenSongPort"] = $("#set-port").val();
    localStorage["OpenSongPwd"] = $.trim($("#set-pwd").val());
    $("#host-status2").html('');
    $("#host-status").html(i18n.t("setup.net3",{host: OpenSongHost}));
    if ("WebSocket" in window) {
      var sok = new WebSocket(OpenSongWs);
      sok.onopen = function() {
        // Web Socket is connected, send data using send()
        $("#host-status").html(i18n.t("setup.net2"));
        sok.send('/ws/subscribe/presentation');
          $( "body" ).pagecontainer( "change", "#service-manager");

      };
      sok.onmessage = function (evt) { 
        OpenSong.updateStatus(evt.data);
      };
      sok.onerror = function() { 
        // websocket is closed.
        $("#host-status").html('<strong>' +  i18n.t("setup.net3") + '</strong>');
      };
      sok.onclose = function() { 
        // websocket is closed.
        $("#host-status").html('<strong>' +  i18n.t("setup.net4") + '</strong>');
      };
    } else {
      // The browser doesn't support WebSocket
        $("#host-status").html('<strong>' +  i18n.t("setup.net5") + '</strong>');
    } // if websocket
//    if (sok.readyState == 1 ) {
      OpenSong.Herladen();
//    }
  },
  showHost: function (event) {
    event.preventDefault();
    $('input[id=set-host]').val(localStorage['OpenSongHost']);
    $('input[id=set-port]').val(localStorage['OpenSongPort']);
    if (typeof localStorage["OpenSongPwd"] !='undefined') {
      if (localStorage['OpenSongPwd'] != '') {
        $('input[id=set-pwd]').val(localStorage['OpenSongPwd'] + '                  ');
      }
    }
    $("#screen-size").val(localStorage["OpenSongtekstSize"]);
    $("#screen-size").slider('refresh');
  },
  Herladen: function () {
    playlist = '';
    lastStatus = '';
    lastMode = '';
    lastSectie = -1;
    lastSlide = -1;
    currentSectie = -1;
    currentSlide = -1;
    loadServiceBusy = false;
    loadControllerBusy = false;
    updateStatusBusy = false;

    if (localStorage["OpenSongHost"] === null) {
      $( "body" ).pagecontainer( "change", "#setup"); 
    } else {
      OpenSong.getStatus();
//      OpenSong.loadService();
      if ($("#service-manager").is(":visible")) { OpenSong.showService(); }
      if ($("#slide-controller").is(":visible")) { OpenSong.showController(); }
      if ($("#remote-screen").is(":visible")) { OpenSong.showRemoteScreen(); }
    }
  },
  showAlert: function (event) {
    event.preventDefault();
    var pwd = $("#set-pwd").val();
    var alert = ' ' + $("#alert-text").val() + ' ';
    OpenSong.doeAktie("text","presentation/screen/alert/message:" + encodeURIComponent(alert));
    $("#alert-status").html('<br>waarschuwing: ' + alert);
  },
  cancelAlert: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/alert/");
    $("#alert-status").html('<br>geen waarschuwing');
  },
  getStatus: function (event) {
    if (event) {
      event.preventDefault();
    }
    clearTimeout(timer1);
    lastUrl = OpenSongHost + "presentation/status";
    $.ajax({
      type: "GET",
      url: OpenSongHost + "presentation/status",
      dataType: "text",
      success: function (data) {
        OpenSong.updateStatus(data);
      }
    })
  },
  loadRemoteScreen: function() {
    localStorage["OpenSongtekstSize"] = $("#screen-size").val();
    OpenSong.showRemoteScreen();
  },
  search: function (event) {
    event.preventDefault();
    var query = OpenSong.escapeString($("#search-text").val())
    var text = "{\"request\": {\"text\": \"" + query + "\"}}";
    $.getJSON(
      "/api/" + $("#search-plugin").val() + "/search",
      {"data": text},
      function (data, status) {
        var ul = $("#search > div[data-role=content] > ul[data-role=listview]");
        ul.html("");
        if (data.results.items.length == 0) {
          var li = $("<li data-icon=\"false\">").text('');
          ul.append(li);
        }
        else {
            $.each(data.results.items, function (idx, value) {
              if (typeof value[0] !== "number"){
                value[0] = OpenSong.escapeString(value[0])
              }
              ul.append($("<li>").append($("<a>").attr("href", "#options")
                  .attr("data-rel", "dialog").attr("value", value[0])
                  .click(OpenSong.showOptions).text(value[1])));
            });
        }
        ul.listview("refresh");
      }
    );
  },
  showOptions: function (event) {
    event.preventDefault();
    var element = OpenSong.getElement(event);
    $("#selected-item").val(element.attr("value"));
  },
  goLive: function (event) {
    // goLive voegt item aan playlist
    event.preventDefault();
  },
  addToService: function (event) {
    event.preventDefault();
    var id = $("#selected-item").val();
    if (typeof id !== "number") {
        id = "\"" + id + "\"";
    }
    var text = "{\"request\": {\"id\": " + id + "}}";
    $.getJSON(
      "/api/" + $("#search-plugin").val() + "/add",
      {"data": text},
      function () {
        $("#options").dialog("close");
      }
    );
  },
  addAndGoToService: function (event) {
    event.preventDefault();
    var id = $("#selected-item").val();
    if (typeof id !== "number") {
        id = "\"" + id + "\"";
    }
    var text = "{\"request\": {\"id\": " + id + "}}";
    $.getJSON(
      "/api/" + $("#search-plugin").val() + "/add",
      {"data": text},
      function () {
        //$("#options").dialog("close");
        $( "body" ).pagecontainer( "change", "#service-manager");
      }
    );
  },
  escapeString: function (string) {
    return string.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
  }
}
// Initial jQueryMobile options
$(document).on("mobileinit", function(){
  $.mobile.phonegapNavigationEnabled = true;
  $.mobile.allowCrossDomainPages = true;
  $.mobile.defaultDialogTransition = "none";
  $.mobile.defaultPageTransition = "none";

});

// Service Manager
$(document).on("pagebeforeshow", "#service-manager", OpenSong.showService);
$(document).on("click", "#service-refresh", OpenSong.Herladen);
$(document).on("click", "#service-next", OpenSong.nextItem);
$(document).on("click", "#service-previous", OpenSong.previousItem);
// Slide Controller
$(document).on("pagebeforeshow", "#slide-controller", OpenSong.loadController);
$(document).on("click", "#controller-refresh", OpenSong.Herladen);
$(document).on("click", "#controller-next", OpenSong.nextSlide);
$(document).on("click", "#controller-previous", OpenSong.previousSlide);
$(document).on("click", "#controller2-next", OpenSong.nextSlide);
$(document).on("click", "#controller2-previous", OpenSong.previousSlide);
// Remote screen
$(document).on("pagebeforeshow", "#remote-screen", OpenSong.loadRemoteScreen);

// onderstaande zet alle knoppen met deze id goed
$(document).on("click", "#controller-blank", OpenSong.blankDisplay);
$(document).on("click", "#controller-theme", OpenSong.themeDisplay);
$(document).on("click", "#controller-freeze", OpenSong.freezeDisplay);
$(document).on("click", "#controller-show", OpenSong.showDisplay);
// Instellingen
$(document).on("pagebeforeshow", "#setup", OpenSong.showHost);
$(document).on("click", "#set-submit", OpenSong.setHost);
// onderstaande werkt niet...
//$("#screen-size").on('slidestop',OpenSong.setTekstSize(event,ui));
// Alerts
$(document).on("click", "#alert-submit", OpenSong.showAlert);
$(document).on("click", "#alert-cancel", OpenSong.cancelAlert);
// Search
//$("#search-submit").live("click", OpenSong.search);
/*$("#search-text").live("keypress", function(event) {
    if (event.which == 13)
    {
        OpenSong.search(event);
    }
}); 
$("#get-status").live("click", OpenSong.getStatus());
/*$("#go-live").live("click", OpenSong.goLive);
$("#add-to-service").live("click", OpenSong.addToService);
$("#add-and-go-to-service").live("click", OpenSong.addAndGoToService);
$("#search").live("pageinit", function (event) {
}); */

$.ajaxSetup({
  statusCode: {
    401: function() {
      $("#host-status2").html('401 - Unauthorized');
    },
    403: function() {
      $("#host-status2").html('403 - Forbidden');
    }
  },
  error : function (xhr,txtStatus,ErrorThrown) {
    if (xhr.status == 404) {
      $("#host-status2").html('<strong>Ajax: </strong> ' + txtStatus + " " + xhr.status
          + " " + ErrorThrown + " (" + lastUrl + ")");
    } else {
      if (xhr.status != 0) {
        $("#host-status2").html('<strong>Ajax: </strong> ' + txtStatus + " " + xhr.status + " " + ErrorThrown);
        $( "body" ).pagecontainer( "change", "#setup");
//    $("#host-status").html('<strong>verbinding verbroken</strong>');
      }
    }
  },
  cache: true,
  crossDomain : true
});