import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import 'rxjs/add/operator/map';

@Injectable()
export class Locations {

    data: any;
    dataFiltered: any;
    usersLocation: any;

    constructor(public http: Http,   public geolocation: Geolocation) {

    }

    init(data, distance){
        if(!distance)
          distance = 100;
        if(this.dataFiltered){
            return Promise.resolve(this.dataFiltered);
        }

        return new Promise(resolve => {

          return this.applyHaversine(data).then((locations)=>{
            this.data = locations;
            this.dataFiltered = this.data.filter((location) =>  {
                return (location.distance <= distance);  // Distance Check
            }).sort((locationA, locationB) => {
                return locationA.distance - locationB.distance;
            });
            resolve(this.dataFiltered);
          });
        });
    }

    filterDistance(distance){
        if(!distance)
          distance = 100;

        this.dataFiltered = this.data.filter((location) =>  {
            return location.distance <= distance;  // Distance Check
        }).sort((locationA, locationB) => {
            return locationA.distance - locationB.distance;
        });
      }

    load(){

        if(this.data){
            return Promise.resolve(this.data);
        }

        return new Promise(resolve => {

            this.http.get('assets/data/locations.json').map(res => res.json()).subscribe(data => {

                return this.applyHaversine(data.locations).then((locations)=>{
                  this.data = locations;
                  this.data.filter((location) =>  {
                      return location.distance > 25;  // Distance Check
                  }).sort((locationA, locationB) => {
                      return locationA.distance - locationB.distance;
                  });
                  resolve(this.data);
                });
            });

        });

    }

    applyHaversine(locations){
        // var options = {
        //     enableHighAccuracy: true,
        //     timeout: 5000,
        //     maximumAge: 0
        // };
      
        return this.geolocation.getCurrentPosition().then((position) => {
        this.usersLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        return locations;
      },  (error) => {
        this.usersLocation = {
            lat: 40.713744,
            lng: -74.009056
        };
        return locations;

      }).then((locations) => {
        locations.map((location) => {

            let placeLocation = {
                lat: location.latitude,
                lng: location.longitude
            };

            location.distance = Number(this.getDistanceBetweenPoints(
                this.usersLocation,
                placeLocation,
                'km'
            ).toFixed(2));
        });

        return locations;
      });
    }

    getDistanceBetweenPoints(start, end, units){

        let earthRadius = {
            miles: 3958.8,
            km: 6371
        };

        let R = earthRadius[units || 'km'];
        let lat1 = start.lat;
        let lon1 = start.lng;
        let lat2 = end.lat;
        let lon2 = end.lng;

        let dLat = this.toRad((lat2 - lat1));
        let dLon = this.toRad((lon2 - lon1));
        let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        let d = R * c;

        return d;

    }

    toRad(x){
        return x * Math.PI / 180;
    }

}
