/******************************************************************************
 * OpenSong - Open Source Lyrics Projection                                    *
 * --------------------------------------------------------------------------- *
 aangepast voor OpenSong, mrt 2019 CRB                                     
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
var totalSlides = -1;
var Playlist;
var sok;
var loadServiceBusy;
var loadControllerBusy;
var updateStatusBusy;
var lastUrl;
var invoegVersie = 1;   // 2 = support songinsert with comma ; 1 = support songinsert with spaces

if (localStorage["OpenSongHost"] === null) {
  localStorage["OpenSongHost"] = '127.0.0.1';
  localStorage["OpenSongPort"] = '8082';
  localStorage["OpenSongPwd"] = '';
}
OpenSongHost = 'ws://' + localStorage["OpenSongHost"] + ':' + localStorage["OpenSongPort"] + '/ws';

if (localStorage["OpenSongtekstSize"] === null) {
  localStorage["OpenSongtekstSize"] = '15';
} else {
  if (localStorage["OpenSongtekstSize"] > 30) {
    localStorage["OpenSongtekstSize"] = '15';
  }
}
if (localStorage["OpenSongDiaregelaar"] === null) {
  localStorage["OpenSongDiaregelaar"] = 'a';
}
if (localStorage["OpenSongRemote"] === null) {
  localStorage["OpenSongRemote"] = 'c';
}
if (localStorage["OpenSongDisplay"] === null) {
  localStorage["OpenSongDisplay"] = '2';
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
    //console.groupCollapsed('start loadService');
    //console.trace();
    if (event) {
      event.preventDefault();
    }
    if (loadServiceBusy == true) {
       //console.log('exit want loadService is al bezig');
       //console.groupEnd();
       return;
    }
    loadServiceBusy = true;
    //console.log('GET "presentation/slide/list"');
    $.ajax({
      type: "GET",
      url: OpenSongHost + "presentation/slide/list",
      dataType: "xml",
//      async : false,
      success: function (xmlPlaylist) {
          //console.log('GET "presentation/slide/list" success');
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
          var n = $(xmlPlaylist).find('response').find('slide').length;
          //console.log('total slides: ' + totalSlides + '; nu ontvangen: ' + n);
          if (n != totalSlides) {
            // aantal is veranderd, nu bijwerken
            //console.log('nu bijwerken');
            totalSlides = n;
            var s = 1;   // tel songs
            var ul = $("#service-manager > div[role=main] > ul");
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
          }
          loadServiceBusy = false;
          OpenSong.showService();
          if ($("#slide-controller").is(":visible")) {
            OpenSong.loadController(currentSlide);
          }
        }  // einde succes function  
    });   // einde ajax
    //console.log('einde loadService');
    //console.groupEnd();
  },
  showService : function () {
    //console.groupCollapsed('start showService');
    //console.trace();
    var ip = 0;
    var ih = 0;
    if (currentSlide == -1) {
      OpenSong.getStatus();
    //console.groupEnd();
      return;
    }
    if (currentSectie == 0) {
      n = $(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie');
    } else {
      n = currentSectie;
    }
    //console.log('currentSectie: '+n+'; currentSlide: '+ currentSlide);
    $("#service-manager div[role=main] ul .ui-btn-e").removeClass("ui-btn-e").addClass("ui-btn ui-btn-c");
    $("#service-manager div[role=main] ul li").each(function () {
      var item = $(this);
      var dezeSectie = item.attr("sectie");  
      if (dezeSectie == n ) {
        item.find('a').removeClass("ui-btn-c").addClass("ui-btn ui-btn-e");
        ip = item.offset().top;
        ih = item.height();
        return false;
      }
    });
    //console.log('scrollen naar: ',ip);
    try {
      $("#service-manager div[role=main] ul").listview("refresh");
      var wh = $(window).height() - 100;
      var ws = $(window).scrollTop();
      if (((ip + ih - ws) > wh ) || ((ip-ih-ih) < ws)) {
        $.mobile.silentScroll(ip-wh/2);
      }
    }
    catch(e){
//      alert('An error has occurred: '+e.message)
    }
    //console.groupEnd();
  },
  loadController: function () {
    //console.groupCollapsed('start loadController');
    //console.trace();
    var n = $("#slides li").length;
    //console.log('aantal items: ',n);
    if ((currentSectie == lastSectie) && (lastSectie != -1) && (n>1)){
      //console.log('exit want nog in zelfde sectie')
      //console.groupEnd();
      return;
    }
    if (loadControllerBusy == true) {
      //console.log('exit want loadController is bezig')
      //console.groupEnd();
      return;
    }
    lastSectie = currentSectie;
    var lastpresentid = '';
    var sn = currentSlide;
    var ajaxBusy = 0;
    var ul = $("#slides");
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
        var li = $('<li data-icon="false" id="slides">').append(
                $("<a href=\"#\">").attr("slide", parseInt(s, 10)).attr('vers',vers).html(tekst));
        li.children("a").click(OpenSong.setSlide);
        ul.append(li);
        lastUrl = "presentation/slide/" + s;
        ajaxBusy++;
        //console.log('ajax call %d afgevuurd',ajaxBusy);
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
                verzen = verzen.replace(/^V/i, '');
                verzen = verzen.replace(/ V/gi, ' ');
                verzen = verzen.replace(/B/gi, i18n.t("setup.bridge"));
                verzen = verzen.replace(/C/gi, i18n.t("setup.chorus"));
                verzen = verzen.replace(/T/gi, i18n.t("setup.tag"));
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
                    + '/image/width:160" align="right">' + tekst;
                }
              }
              if (soort == 'external') {
                var app = $(xmlSong).find('response').find('slide').attr('application');
                var bestand = $(xmlSong).find('response').find('slide').attr('filename');
                bestand = bestand.replace(/^.*[\\\/]/, '');
                var desc = $(this).find('description').text();
                tekst = tekst + '(' + app + ') ' + desc + ' - ' + bestand;
              }
              tekst = tekst.replace(/^\t/gm, '&nbsp;&nbsp;&nbsp;&nbsp;');
              tekst = tekst.replace(/-\n/gm, '&shy;');
              tekst = tekst.replace(/\n/g, '<br>');
              tekst = tekst.replace(/[ \u00A0]<br>/g, ' ');
              if (soort == 'song') {
                if ($(this).attr('id')) {
                  var vers = $(this).attr('id');
                  verst = vers.replace(/V/i, '');
                  verst = verst.replace(/B/gi,i18n.t("setup.bridge"));
                  verst = verst.replace(/C/gi, i18n.t("setup.chorus"));
                  verst = verst.replace(/T/gi, i18n.t("setup.tag"));
                  tekst = '<sup>' + verst + ' </sup>' + tekst;
                }
              }
              if ($('#regelaarsoort-b').is(":checked")) {
                // voeg thumb toe
                tekst = '<div style="float:right;"><img src="' + OpenSongHost + 'presentation/slide/' + slideId
                    + '/image/width:240/quality:85"></div>' + tekst;   
              }
              if ($('#regelaarsoort-c').is(":checked")) {
                // toon alleen plaatje
                tekst = '<span>&nbsp;</span><img src="' + OpenSongHost + 'presentation/slide/' + slideId
                    + '/image/width:360/quality:85">';   
              }
              // vul nu de li lijstitem met de opgehaalde gegevens
              $("#slide-controller div[role=main] ul li a").each(function () {
                var item = $(this);
                if (item.attr("slide") == slideId) {
                  item.attr('vers',vers).html(tekst);
                  return false;
                }
              });
            })
            // ajax call is klaar, maar we kunnen pas showController doen
            //      als alle ajax calls klaar zijn
            ajaxBusy--;
            if (ajaxBusy <= 0) {
              //console.log('alle ajax calls zijn klaar, doe nu showController');
              OpenSong.showController();
            } else {
              //console.log('nog %d uitstaande ajax calls',ajaxBusy);
            }
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
        titel = naam + ' ' + titel;
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
            titel = naam + ' ' + titel;
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
//    OpenSong.showController();
    loadControllerBusy = false;
    //console.log('einde loadController')
    //console.groupEnd();
  },
  showController : function () {
    //console.groupCollapsed('start showController');
    //console.trace();
    if (currentSlide == -1) {
      OpenSong.getStatus();
    //console.groupEnd();
      return;
    }
    var ip  = 0;
    var ih = 0;
    $("#slide-controller div[role=main] ul  .ui-btn-e").removeClass("ui-btn-e").addClass("ui-btn");
    $("#slide-controller div[role=main] ul a").each(function () {
      var item = $(this);
      if (item.attr("slide") == currentSlide.toString()) {
        item.removeClass("ui-btn-c").addClass("ui-btn-e");
        item = item.parent();
        ip = item.offset().top;
        ih = item.height();
        return false;
      }
    });
    //console.log('scrollen naar: ',ip);
    $("#slide-controller div[role=main] ul").listview("refresh");
    var wh = $(window).height() - 100;
    var ws = $(window).scrollTop();
    if (((ip + ih - ws) > wh ) || ((ip-ih-ih) < ws)) {
      $.mobile.silentScroll(ip-wh/2);
    }
    //console.groupEnd();
  },
  showRemoteScreen : function () {
    //console.groupCollapsed('start showRemoteScreen');
    if (($('#screensoort-a').is(":checked")) && (lastMode != 'B')) {
      // zwarte letters op wit scherm
      $("#remote-screen").removeClass("ui-page-theme-a").addClass("ui-page-theme-c")
    } else {
      // witte letters op zwart scherm of plaatje op zwart scherm
      $("#remote-screen").removeClass("ui-page-theme-c").addClass("ui-page-theme-a")
    }

    if (lastMode == 'N') {
      var sn = currentSlide;
      var tsize = localStorage["OpenSongtekstSize"];
      lastUrl = "presentation/slide/" + sn;
        $.ajax({
          type: "GET",
          url: OpenSongHost + lastUrl,
          dataType: "xml",
          success: function (xmlSong) {
            titel = $(xmlSong).find('response').find('slide').find('title').text();
            verzen = $(xmlSong).find('response').find('slide').find('presentation').text();
            if (titel != '') {
              if (verzen.trim() != '') {
                aVerzen = verzen.split(' ');
                currentVers = $(xmlSong).find('response').find('slides').find('slide').attr('PresentationIndex');
                // array index is zero based, index is 1 based
                var i;
                verzen = '';
                for (i = 0; i < aVerzen.length; i++) {
                  if (i == (currentVers -1)) {
                    if (/^B/i.test(aVerzen[i]) ) {
                      verzen += '<strong>' + i18n.t("setup.bridge") + '</strong> ';
                    }
                    if (/^C/i.test(aVerzen[i]) ) {
                      verzen += '<strong>' + i18n.t("setup.chorus") + '</strong> ';
                  //console.log('check vers: ' + aVerzen[i]);
                    }
                    if (/^T/i.test(aVerzen[i]) ) {
                      verzen += '<strong>' + i18n.t("setup.tag") + '</strong> ';
                    }
                    if (/^V(\S)*/i.test(aVerzen[i]) ) {
                      verzen += '<strong>' + aVerzen[i].substr(1,15) + '</strong> ';
                    }
                  } else {
                    if (/^V(\S)*/i.test(aVerzen[i]) ) {
                      verzen += aVerzen[i].substr(1,15)  + ' ';
                    }
                  }
                }
                titel += ': ' + verzen.trim().toLowerCase().replace(/ /g, ', '); 
              }
            } else {
              titel = '';
            }
            var soort = $(xmlSong).find('response').find('slide').attr('type');
            $(xmlSong).find('response').find('slide').find('slides').find('slide').each(function() {
              var tekst = $(this).find('body').text();
              //console.log('origigineel: ' + tekst);
              if ((soort == 'image') || ($('#screensoort-c').is(":checked"))) {
                $("#current-screen-titel").css('font-size',(tsize * 0.85) + 'vmin').html('');                
                $('#remote-main').addClass('geenpad');
                var ww = $(window).width();
                var wh = $(window).height() -20;
                tekst = '<img src="' + OpenSongHost + 'presentation/slide/' + sn;   
                if (wh < (ww * 16 / 9)) {
                  tekst = tekst + '/image/height:' + wh;   
                } else {
                  tekst = tekst + '/image/width:' + ww;   
                }
                tekst = tekst + '/Math.random()" width="' + ww + 'px">';   
              } else {
                $('#remote-main').removeClass('geenpad');
                $("#current-screen-titel").css('font-size',(tsize * 0.85) + 'vmin').html(titel);                
              }
              if (soort == 'external') {
                var app = $(xmlSong).find('response').find('slide').attr('application');
                var bestand = $(xmlSong).find('response').find('slide').attr('filename');
                bestand = bestand.replace(/^.*[\\\/]/, '');
                var desc = $(this).find('description').text();
                tekst = tekst + '(' + app + ') ' + desc + ' - ' + bestand;
              }
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
              if (soort == 'scripture') {
                // maak versnummers (1-3 cijfers) superscript
                tekst = tekst.replace(/(\d\d?\d?[abc]?) /g,'<sup>$1&nbsp;</sup>');
              }
              // de volgorde van de replaces is belangrijk
              tekst = tekst.replace(/^\t/gm, '&nbsp;&nbsp;&nbsp;&nbsp;');
              tekst = tekst.replace(/-\n/gm, '&shy;');
              tekst = tekst.replace(/\n/g, '<br>');
              tekst = tekst.replace(/[ \u00A0]<br>/g, ' ');
              //console.log('transform 6: ' + tekst);
              
              if ((soort == 'image') || ($('#screensoort-c').is(":checked"))) {
                // als ik de font-size niet klein set, wordt de div overhoog gedrukt en komt er een vertical scrollbar
                $("#current-screen-tekst").css('font-size','1px').html(tekst);
              } else {
                $("#current-screen-tekst").css('font-size',tsize + 'vmin').html(tekst);
              }
            })
          } // ajax succes function
      })   // ajax
    } else {
      if (lastMode != 'F') {
        $("#current-screen-titel").text(' ');
        $("#current-screen-tekst").html('');
      }
    }
    //console.groupEnd();
  },
  doeAktie: function(soort,opdracht) {
    //console.groupCollapsed('start doeAktie');
    lastUrl = opdracht;
    //console.log('opdracht: ',opdracht);
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
        succes: function (antwoord,status,xhr) {
          //console.log(lastUrl + ' -> ' + status + ' ' + xhr.status);
          $("#host-status2").html('last Ajax response: ' + antwoord);
        }
      })
    } else {
      $.ajax({
        type: "POST",
        url: OpenSongHost + opdracht,
        crossDomain : true,
        dataType: soort,
        succes: function (antwoord) {
          //console.log(lastUrl + ' -> ' + antwoord.response.status);
          $("#host-status2").html('last Ajax response: ' + antwoord);
        }
      });
    }
    //console.groupEnd();  
  },
  setSectie: function (event) {
    event.preventDefault();
    var slide = OpenSong.getElement(event);
    var slideno = slide.attr("slide");
    OpenSong.doeAktie("text","presentation/slide/" + slideno);
    $('body').pagecontainer( "change", "#slide-controller");
  },
  setSlide: function (event) {
    event.preventDefault();
    var slide = OpenSong.getElement(event);
    var slideno = slide.attr("slide");
    OpenSong.doeAktie("text","presentation/slide/" + slideno);
  },
  updateStatus: function (data) {
    //console.group('start updateStatus');
    //console.trace();
    if (data == 'OK') {
      //console.log('OK ontvangen');
      //console.groupEnd();
      return;
    };
    if (updateStatusBusy == true) {
      //console.log('is nog bezig');
      //console.groupEnd();
      return;
    }
    //console.log('ontvangen status: ' + data);
    updateStatusBusy = true;
    parser=new DOMParser();
    xml=parser.parseFromString(data,"text/xml");
    if ($(xml).find('response').find('presentation').attr('running') == "1") {
      $("#host-status").html(i18n.t("setup.net2"));
      if ($(xml).find('response').find('presentation').find('slide').attr('itemnumber')) {
          currentSlide = $(xml).find('response').find('presentation').find('slide').attr('itemnumber');
      }
      if ($(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie')) {
        currentSectie = $(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('sectie');
      } else {
        currentSectie = 0;
      }
      var currentMode = $(xml).find('response').find('presentation').find('screen').attr('mode');
      // check nu of slidename van status klopt met slidename in de playlist
      statusReden = $(Playlist).find('response').attr('reason');
      if (statusReden !== undefined) {
        //console.log('response reason ' + statusReden);
        invoegVersie = 2
        lastSlide = -1; lastSectie = -1;  // force reload        
      }
      statusNaam = $(xml).find('response').find('presentation').find('slide').find('name').text();
      playItemName = $(Playlist).find('response').find('slide[identifier="' + currentSlide + '"]').attr('name');
      if ((statusNaam !=='') && (statusNaam !== playItemName)) {
        //console.log('reloaden! - statusNaam: ' + statusNaam + '; playItemName: ' + playItemName);
        lastSlide = -1; lastSectie = -1;  // force reload        
      }
    } else {
      // geen lopende presentatie
      $("#host-status").html('<strong>' + i18n.t("setup.net6") + '</strong> (' + i18n.t("setup.net2") + ')');
      currentMode = "X";
      playlist = '';
      lastStatus = '';
      lastMode = '';
      lastSectie = -1;
      lastSlide = -1;
      currentSectie = -1;
      currentSlide = -1;
      totalSlides = -1;
      loadServiceBusy = false;
      loadControllerBusy = false;
      updateStatusBusy = false;
      // zet alle knoppen uit
      $(".status-show").removeClass("ui-btn-c ui-btn-c").addClass("ui-btn-b");
      // maak schermen leeg
      $("#service-manager > div[role=main] > ul").html('<li data-icon="false">'+i18n.t("setup.net6")+"</li>");
      $("#service-manager > div[role=main] > ul").listview().listview("refresh");
      $("#slide-controller > div[role=main] > ul").html("");
      // vermeld status
      if ($("#slide-controller").is(":visible")) {
        $("#controller-titel").text(i18n.t("setup.net6"));
      }
      if ($("#remote-screen").is(":visible")) {
        $("#remote-screen").removeClass("ui-page-theme-c").addClass("ui-page-theme-a")
        $("#current-screen-titel").text(i18n.t("setup.net6"));
        $("#current-screen-tekst").html('');
      }
      if ($("#presentatie").is(":visible")) {
        $("#set-show").removeClass("ui-btn-b").addClass("ui-btn-e");
        $("#set-stop1").removeClass("ui-btn-e").addClass("ui-btn-b");
      }
      if ($("#search").is(":visible")) {
        $("#song-show").removeClass("ui-btn-b").addClass("ui-btn-e");
        $("#song-stop1").removeClass("ui-btn-e").addClass("ui-btn-b");
      }
        
    } // else if running == 1
    var modeChange = 0;
    if (currentMode != lastMode) {
      modeChange = 1;
    }
    //console.log('current mode: %s, lastMode: %s',currentMode,lastMode);
    lastMode = currentMode;
    // knoppen altijd zetten
    $(".status-show").removeClass("ui-btn-c").addClass("ui-btn-b");
    $(".status-zwart, .status-freeze, .status-theme").removeClass("ui-btn-c ui-btn-e").addClass("ui-btn-b");
    $('#controller-modeC').html('&nbsp;');
    $('#controller-modeS').html('&nbsp;');
    // afhankelijk van status juiste knop aan zetten
    switch (currentMode) {
          case 'N' :
            $(".status-show").removeClass("ui-btn-b").addClass("ui-btn-c");
            $('#controller-modeC').text(i18n.t("state.normal"));
            $('#controller-modeS').text(i18n.t("state.normal"));
            break;;
          case 'B' :
            $(".status-zwart").removeClass("ui-btn-b").addClass("ui-btn-e");
            $('#controller-modeC').text(i18n.t("state.black"));
            $('#controller-modeS').text(i18n.t("state.black"));
            break;;
          case 'F' :
            $(".status-freeze").removeClass("ui-btn-b").addClass("ui-btn-e");
            $('#controller-modeC').text(i18n.t("state.freeze"));
            $('#controller-modeS').text(i18n.t("state.freeze"));
            break;;
          case 'H' :
            $(".status-theme").removeClass("ui-btn-b").addClass("ui-btn-e");
            $('#controller-modeC').text(i18n.t("state.hide"));
            $('#controller-modeS').text(i18n.t("state.hide"));
            break;;
    }
//      }; // if current mode != lastmode
    if (currentMode != "X") {
      if (lastSlide == -1) { 
          OpenSong.loadService();   
      } else{
        if ($("#service-manager").is(":visible")) {
          if ((lastSlide != currentSlide) && (currentSlide > 0)) {
            OpenSong.showService();
          }
        };
        if ($("#slide-controller").is(":visible")) {
          if ((lastSectie == -1) || (lastSectie != currentSectie)) {
            OpenSong.loadController(currentSlide);
          }
          if ((lastSlide != currentSlide) && (currentSlide > 0)) {
            OpenSong.showController(currentSlide);
          }
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
    //console.groupEnd();
  },
  nextItem: function (event) {
    //console.log('next item');
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/section/next");
  },
  previousItem: function (event) {
    //console.log('previous item');
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/section/previous","");
  },
  nextSlide: function (event) {
    //console.log('next slide');
    event.preventDefault();
    //console.log('nextSlide: ' + event.type);
    OpenSong.doeAktie("text","presentation/slide/next","");
  },
  previousSlide: function (event) {
    //console.log('previous slide');
    event.preventDefault();
    //console.log('previousSlide: ' + event.type);
    OpenSong.doeAktie("text","presentation/slide/previous","");
  },
  blankDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_black","");
    if ($("#popupModeC").parent().hasClass("ui-popup-active")){
      $("#popupModeC").popup("close");
    }
    if ($("#popupModeS").parent().hasClass("ui-popup-active")){
      $("#popupModeS").popup("close");
    }
  },
  themeDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_hide","");
    if ($("#popupModeC").parent().hasClass("ui-popup-active")){
      $("#popupModeC").popup("close");
    }
    if ($("#popupModeS").parent().hasClass("ui-popup-active")){
      $("#popupModeS").popup("close");
    }
  },
  freezeDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/toggle_freeze","");
    if ($("#popupModeC").parent().hasClass("ui-popup-active")){
      $("#popupModeC").popup("close");
    }
    if ($("#popupModeS").parent().hasClass("ui-popup-active")){
      $("#popupModeS").popup("close");
    }
  },
  showDisplay: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/normal","");
    if ($("#popupModeC").parent().hasClass("ui-popup-active")){
      $("#popupModeC").popup("close");
    }
    if ($("#popupModeS").parent().hasClass("ui-popup-active")){
      $("#popupModeS").popup("close");
    }
  },
  setHost: function (event) {
    //console.groupCollapsed('start setHost');
    typeof event !== 'undefined' ? event.preventDefault() : false;
    OpenSong.saveSettings;
    if ((typeof sok != 'undefined') && (sok.readyState == 1)) {
      // connectie is open, eerst sluiten
      sok.close();
    }
    OpenSongHost = 'http://' + $("#set-host").val() + ':' + $("#set-port").val() + '/';
    OpenSongWs = 'ws://' + $("#set-host").val() + ':' + $("#set-port").val() + '/ws';
    OpenSong.saveSettings();
    $("#host-status2").html('');
    $("#host-status").html(i18n.t("setup.net3",{host: OpenSongHost}));
    if ("WebSocket" in window) {
      var sok = new WebSocket(OpenSongWs);
      sok.onopen = function() {
        // Web Socket is connected, send data using send()
        $("#host-status").html(i18n.t("setup.net2"));
        sok.send('/ws/subscribe/presentation');
        //OpenSong.loadService();
        if ($("#setup").is(":visible")) {
          $("body").pagecontainer( "change", "#slide-controller");
        }
      };
      sok.onmessage = function (evt) { 
        OpenSong.updateStatus(evt.data);
      };
      sok.onerror = function() { 
        // websocket is closed.
        $("#host-status").html('<strong>' +  i18n.t("setup.net3") + '</strong>');
        $("#host-status").html('<strong>' +  i18n.t("setup.net4") + '</strong>');
        if ($("#remote-screen").is(":visible")) {
          $("#current-screen-titel").text(i18n.t("setup.net4"));
          $("#current-screen-tekst").text('');
          setTimeout(function() {
            OpenSong.setHost();
          },60000);
        } else {
          $( "body" ).pagecontainer( "change", "#setup");
        }
      };
      sok.onclose = function() { 
        // websocket is closed.
        $("#host-status").html('<strong>' +  i18n.t("setup.net4") + '</strong>');
        if ($("#remote-screen").is(":visible")) {
          $("#current-screen-titel").text(i18n.t("setup.net4"));
          $("#current-screen-tekst").text('');
          setTimeout(function() {
            OpenSong.setHost();
          },60000);
        } else {
          $( "body" ).pagecontainer( "change", "#setup");
        }
      };
    } else {
      // The browser doesn't support WebSocket
        $("#host-status").html('<strong>' +  i18n.t("setup.net5") + '</strong>');
    } // if websocket
    //console.clear();
    OpenSong.Herladen();
    //console.groupEnd();
  },
  showHost: function (event) {
    //console.group('start showHost');
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

    var n = localStorage["OpenSongRemote"];
    $("input:radio[name=screensoort-]").filter("[value="+ n +"]").attr("checked","checked");
    $("input:radio[name=screensoort-]").checkboxradio('refresh');
    n = localStorage["OpenSongDiaregelaar"];
    $("input:radio[name=regelaarsoort-]").filter("[value="+ n +"]").attr("checked","checked");
    $("input:radio[name=regelaarsoort-]").checkboxradio('refresh');
    // zet ook velden op andere schermen
    n = localStorage["OpenSongDisplay"];
    $("input:radio[name=display-]").filter("[value="+ n +"]").attr("checked","checked");
    //console.groupEnd();
  },
  Herladen: function () {
    //console.groupCollapsed('start herladen');
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
    $('#search-sets').empty();
    $('#search-folders').empty();

    if (localStorage["OpenSongHost"] === null) {
      $( "body" ).pagecontainer( "change", "#setup"); 
    } else {
      if ($("#service-manager").is(":visible")) { OpenSong.showService(); }
      if ($("#slide-controller").is(":visible")) { OpenSong.showController(); }
      if ($("#remote-screen").is(":visible")) { OpenSong.showRemoteScreen(); }
    }
    OpenSong.getStatus();
    //console.groupEnd();
  },
  showAlert: function (event) {
    event.preventDefault();
    var pwd = $("#set-pwd").val();
    var alert = $("#alert-text").val();
    OpenSong.doeAktie("text","presentation/screen/alert/message:" + encodeURI(alert));
    $("#alert-status").html('<br>' + i18n.t("alert.alert") + ': ' + alert);
  },
  cancelAlert: function (event) {
    event.preventDefault();
    OpenSong.doeAktie("text","presentation/screen/alert/");
    $("#alert-status").html('<br>' + i18n.t("alert.noalert"));
  },
  getStatus: function (event) {
    if (event) {
      event.preventDefault();
    }
    //console.log('getstatus');
    //if (timer1) {clearTimeout(timer1); }
    lastUrl = "presentation/status";
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
   OpenSong.showRemoteScreen();
  },
  showRemoteMenu: function() {
    //console.log('showRemoteMenu');
    $( "#leftpanel1" ).panel( "open" );
    setTimeout(function() {
        $( "#leftpanel1" ).panel( "close" );
      },7000);

  },
  showPresent: function() {
    //console.groupCollapsed('start showPresent');
    if ($('#search-sets').find('option').length <= 0) {
      $('#sets-status').show();
      $('#search-sets').empty();
      $('#search-sets').append('<option value="choose-one">' + i18n.t("setup.choose") +
                               '</option>');
      lastUrl = OpenSongHost + "set/list/";
      $.ajax({
        type: "GET",
        url: OpenSongHost + "set/list",
        dataType: "xml",
        success: function (xmlFolders) {
          Folders = xmlFolders;
            $(Folders).find('response').children().each(function() {
               if ($(this).attr('id')) {
                  var name = $(this).text();
                  $('#search-sets').append('<option value="' + name + '">'
                    + name + '</option>')
               }
            });
          $('#search-sets').selectmenu('refresh');
          $("#search-sets option:first").attr("selected", "selected");
          $('#sets-status').hide();
        }
      });
    }
    var n = localStorage["OpenSongDisplay"];
    //console.log('set display op: ',n);
    $("input:radio[name=display-]").filter("[value="+ n +"]").attr("checked","checked");
    $("input:radio[name=display-]").checkboxradio('refresh');
    if (lastMode != "X") {
      $("#set-show").removeClass("ui-btn-e").addClass("ui-btn-b");
      $("#set-stop1").removeClass("ui-btn-b").addClass("ui-btn-e");
    } else {
      $("#set-show").removeClass("ui-btn-b").addClass("ui-btn-e");
      $("#set-stop1").removeClass("ui-btn-e").addClass("ui-btn-b");
    }
    //console.groupEnd();
  },
  loadSearch: function() {
    //console.groupCollapsed('start loadSearch');
    lastUrl = OpenSongHost + "song/folders/";
    if ($('#search-folders').find('option').length <= 0) {
      $.ajax({
        type: "GET",
        url: OpenSongHost + "song/folders/",
        dataType: "xml",
        success: function (xmlFolders) {
          Folders = xmlFolders;
            $(Folders).find('response').find('folders').children().each(function() {
              if ($(this).attr('name')) {
                var name = $(this).attr('name');
                if (name.indexOf('( ') < 0) {
                  $('#search-folders').append('<option value="' + name + '">' + name + '</option>');
                }
              }
           });
          $('#search-folders').prop("selectedIndex",0).selectmenu('refresh');
          OpenSong.doeSearch();
        }
      });
    }
    //console.groupEnd();
  },
  showSearch: function() {
    //console.groupCollapsed('start showSearch');
    if ($('#search-folders').find('option').length <= 0) {
      OpenSong.loadSearch();
      //OpenSong.doeSearch();
    };
    $("#song-insert").removeClass("ui-btn-e").addClass("ui-btn-b");
    var ip = 0;
    var ih = 0;
    $("#search-results a").each(function () {
      var item = $(this);
      //console.log('item:  ',item.text());
      if (item.hasClass('ui-btn-e')) {
        item = item.parent();
        ip = item.offset().top;
        ih = item.height();
        return false;
      }
    });
    //console.log('scrollen naar: ',ip);
    var wh = $(window).height() - 100;
    var ws = $(window).scrollTop();
    if (((ip + ih - ws) > wh ) || ((ip-ih-ih) < ws)) {
      $.mobile.silentScroll(ip-wh/2);
    }
    //console.groupEnd();
  },
  doeSearch: function (event) {
    //event.preventDefault();
    //console.groupCollapsed('start doeSearch');
    $("#song-insert").removeClass("ui-btn-e").addClass("ui-btn-b");
    $('#song-status').show();
    $('#search-results').empty();
    $('input[data-type="search"]').val("");
    map = $('#search-folders option:selected').text();
    //console.log('map: ' + map);
    lastUrl = OpenSongHost + "song/list/folder:" + encodeURI(map);
    $.ajax({
      type: "GET",
      url: lastUrl,
      dataType: "xml",
      success: function (xmlSongs) {
        Songs = xmlSongs;
          $(Songs).find('response').children().each(function() {
             if ($(this).attr('name')) {
                var name = $(this).attr('name');
                //console.log('add: ' + name);
                var li = $('<li data-icon="false">').append($('<a href="#">').text(name));
                li.children("a").click(OpenSong.selectSearch);
                $('#search-results').append(li)
             }
        });
        $('#search-results').listview().listview("refresh");
        $('#song-status').hide();
      }
    });
    //console.groupEnd();
  },
  selectSearch: function () {
    //console.groupCollapsed('start selectSearch');
    var song = $(this).text();
    //console.log('selected: ',song);

    $("#search-results .ui-btn-e").removeClass("ui-btn-e").addClass("ui-btn");
    //console.groupCollapsed('loop items');
    $("#search-results a").each(function () {
      var item = $(this);
      //console.log(item.text());
      if (item.text() == song) {
          item.removeClass("ui-btn-c").addClass("ui-btn-e");
          return false;
      }
    });
    //console.groupEnd();
    $("#search-results").listview("refresh");
    if (lastMode != "X") {
      $("#song-insert").removeClass("ui-btn-b").addClass("ui-btn-e");
    } else {
      $("#song-insert").removeClass("ui-btn-e").addClass("ui-btn-b");
    }

    //console.groupEnd();
  },
  insertSong: function (event) {
    if (event) {event.preventDefault(); }
    map = $('#search-folders option:selected').text();
    song = $("#search-results .ui-btn-e").text();
    //console.log('songdetails ophalen van ' + song + ' uit ' + map);
    $("#songselect").text(map + '/' + song);
    $("#songselect2").text();
    $("#popupSong").popup("open");
    // retrieve songtekst
    lastUrl = OpenSongHost + "song/detail/" + encodeURI(song) + "/folder:" + encodeURI(map);
    $.ajax({
      type: "GET",
      url: lastUrl,
      dataType: "xml",
      success: function (xmlSong) {
          dezeSong = $(xmlSong).find('response').find('song');
          titel = $(dezeSong).find('title').text();
          if (titel != song ) {
            $("#songselect").text(map + '/ ' + song);
          } else {
            $("#songselect").text(map);
          }
          $("#songselect2").text(titel);
          volgorde = $(dezeSong).find('presentation').text();
          $("#set-verse").val(volgorde);
          songtekst = $(dezeSong).find('lyrics').text();
          $("#songLyrics").html(songtekst);
          $("#songLyrics").scrollTop(0);
        }
    });

  },
  insertSongYes: function (event) {
    if (event) {event.preventDefault(); }
    map = $('#search-folders option:selected').text();
    song = $("#search-results .ui-btn-e").text();
    verses = $("#set-verse").val();
    if (invoegVersie >= 2) {
      verses = verses.replace(/ /gi,",");
    }
    verses = verses.trim();
    //console.log('nu invoegen: ' + song + ' uit ' + map);
    OpenSong.doeAktie("text",'presentation/slide/song/folder:'
                  + encodeURI(map) + '/song:' + encodeURI(song)
                  //+ '/after:0'
                  + '/order:' + encodeURI(verses)
                  ,'');
    $("#popupSong").popup("close");
    if (invoegVersie == 1) {
      /* opensong geeft geen status update (bug!) na remote song insert
       * daarom forceren we een reload */
      lastSlide = -1; lastSectie = -1; totalSlides = -1;
      OpenSong.getStatus();
    }
      setTimeout(function() {
          $('body').pagecontainer( "change", "#service-manager");
      },1000);
  },
  presentShow: function (event) {
    if (event) {event.preventDefault(); }
    //console.groupCollapsed('start presentShow');
    //console.log('lastMode: ',lastMode);
    if ($("#set-show").hasClass("ui-btn-e")) {
      present = $('#search-sets option:selected').val();
      //console.log('nu beamen: ' + present + ' (presentatie)');
      var n=$('input[name=display-]:checked').val();
      OpenSong.doeAktie("text",'set/present/' + encodeURI(present) + '/display:' + n,'');
      $('body').pagecontainer( "change", "#service-manager");
    } else {
      //console.log('popup open');
      $("#popupP").popup("open");
    }
    //console.groupEnd();
  },
  presentStop: function (event) {
    event.preventDefault();
    //console.log('start presentStop');
    OpenSong.doeAktie("text",'presentation/close');
    if ($("#popupP").parent().hasClass("ui-popup-active")){
      $("#popupP").popup("close");
      setTimeout(function() {
        OpenSong.presentShow();
        },3000);
    }
  },
  saveSettings: function() {
    //console.groupCollapsed('start saveSettings');
    localStorage["OpenSongHost"] = $("#set-host").val();
    localStorage["OpenSongPort"] = $("#set-port").val();
    localStorage["OpenSongPwd"] = $.trim($("#set-pwd").val());
    localStorage["OpenSongRemote"] = $('input[name=screensoort-]:checked').val();
    localStorage["OpenSongtekstSize"] = $("#screen-size").val();
    localStorage["OpenSongDiaregelaar"] = $('input[name=regelaarsoort-]:checked').val();
    localStorage["OpenSongDisplay"] = $('input[name=display-]:checked').val();
    //console.log(localStorage);
    //console.groupEnd();
  },
  escapeString: function (string) {
    return string.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
  }
}
// Initial jQueryMobile options
$(document).on("mobileinit", function(){
  //$.mobile.ajaxEnabled = true;  / default = true
  $.mobile.allowCrossDomainPages = true;
  $.mobile.defaultPageTransition = "none";
  //$.mobile.linkBindingEnabled = true; // default = true
  $.mobile.phonegapNavigationEnabled = true;
});
$(document).on("pagecontainerchange", function (event,ui) {
  var activePage = ui.toPage[0].id;
  //console.log('page container change to ',activePage);
  //OpenSong.getStatus();
});
// Service Manager
$(document).on("pageshow","#service-manager", OpenSong.showService);
$(document).on("click","#service-next", OpenSong.nextItem);
$(document).on("click","#service-previous", OpenSong.previousItem);
// Slide Controller
$(document).on("pageinit", "#slide-controller", function(){   
$('#slide-controller').on( "swipeleft",OpenSong.previousSlide);
$('#slide-controller').on( "swiperight",OpenSong.nextSlide);
});
$(document).on("pagebeforeshow", "#slide-controller", OpenSong.loadController);
$(document).on("click","#controller-next", OpenSong.nextSlide);
$(document).on("click","#controller-previous", OpenSong.previousSlide);
$(document).on("click","#controller2-next", OpenSong.nextSlide);
$(document).on("click","#controller2-previous", OpenSong.previousSlide);
// Remote screen
$(document).on("pagebeforeshow","#remote-screen", OpenSong.loadRemoteScreen);
$(document).on("click","#remote-screen",OpenSong.showRemoteMenu);
$(document).on("click","#remote-main",OpenSong.showRemoteMenu);
$('#remote-screen').on( "swiperight",OpenSong.showRemoteMenu);

// onderstaande zet alle knoppen met deze id goed
$(document).on("click", "#controller-blank", OpenSong.blankDisplay);
$(document).on("click", "#controller-theme", OpenSong.themeDisplay);
$(document).on("click", "#controller-freeze", OpenSong.freezeDisplay);
$(document).on("click", "#controller-show", OpenSong.showDisplay);
// Instellingen
$(document).on("pagebeforeshow", "#setup", OpenSong.showHost);
$(document).on("click", "#set-submit", OpenSong.setHost);
// Alerts
$(document).on("click", "#alert-submit", OpenSong.showAlert);
$(document).on("click", "#alert-cancel", OpenSong.cancelAlert);
// Presentaties
$(document).on("pageshow", "#presentatie", OpenSong.showPresent);
$(document).on("click", "#set-show", OpenSong.presentShow);
$(document).on("click", "#set-stop1", OpenSong.presentStop);
$(document).on("click", "#set-stop2", OpenSong.presentStop);
// Search
$(document).on("pageshow", "#search", OpenSong.showSearch);
$(document).on("click", "#song-insert", OpenSong.insertSong);
$(document).on("click", "#song-insert2", OpenSong.insertSongYes);
$(document).on("change", "#search-folders", OpenSong.doeSearch);
// menu
$(document).on("panelopen", "#leftpanel1", OpenSong.saveSettings);
// handle arrow keys

$.ajaxSetup({
  error : function (xhr,txtStatus,ErrorThrown) {
    if (xhr.status != 0) {
      $("#host-status2").html('ajaxError: ' + lastUrl + ' <strong>' +ErrorThrown + '</strong>');
      //console.log('ajaxError: ' +ErrorThrown + ' url: ' + lastUrl);
    } else {
      //console.log('ajaxOK: ' + xhr.status + ' url: ' + lastUrl);
    }
  },
  cache: true,
  crossDomain : true
});