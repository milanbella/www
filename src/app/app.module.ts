import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterModule, RouteReuseStrategy } from '@angular/router';
import { HttpClientModule, HttpClient } from '@angular/common/http';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { Network } from '@ionic-native/network/ngx';
import { Printer } from '@ionic-native/printer/ngx';
import { NavigationBar } from '@ionic-native/navigation-bar/ngx';
import { AppVersion } from '@ionic-native/app-version/ngx';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { PowerManagement } from '@ionic-native/power-management/ngx';

import { NgIdleKeepaliveModule } from '@ng-idle/keepalive'; // this includes the core NgIdleModule but includes keepalive providers for easy wireup
import { Idle } from '@ng-idle/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { NativePlatform } from './services/nativePlatform';
import { BusyBox } from './services/busybox';
import { AlertError } from './services/alerterror';
import { Auth } from './services/auth';
import { AppCache } from './services/appcache';
import { Scanner1 } from './services/scanner1';
import { Scanner } from './services/scanner';
import { S3 } from './services/s3';

import { TestService } from '../test/testService';
import { AuthPrincipalTest } from '../test/authPrincipalTest';
import { SqsTest } from '../test/sqsTest';
import { LoggingTest } from '../test/loggingTest';

import { PhysInvCountsProvider } from './providers/phys-inv-counts/phys-inv-counts';
import { InvMovesProvider } from './providers/inv-moves/inv-moves';
import { DbProductsProvider } from './providers/db-products/db-products';
import { LocatorInfoProvider } from './providers/locator-info/locator-info';
import { ToastProvider } from './providers/toast/toast';


// import { ProductPageModule } from './product/product.module';
//	import { ProductPage } from './product/product';

//Translation                                                                                                                                                                
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';                                                                                                      
import { TranslateHttpLoader } from '@ngx-translate/http-loader'; 

//Translation                                                                                                                                                                
export function createTranslateLoader(http: HttpClient) {                                                                                                                          
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');                                                                                                         
}  

@NgModule({
	declarations: [AppComponent],
	entryComponents: [
		// ProductPage
	],
	imports: [
		IonicModule.forRoot(), 
		BrowserModule, 
		CommonModule, 
		FormsModule, 
		HttpClientModule,
		TranslateModule.forRoot({                                                                                                                                            
			loader: {                                                                                                                                                           
				provide: TranslateLoader,                                                                                                                                       
				useFactory: (createTranslateLoader),                                                                                                                            
				deps: [HttpClient]                                                                                                                                                    
			}                                                                                                                                                                
		}),
		AppRoutingModule,
		NgIdleKeepaliveModule,
		// ProductPageModule

	],
	providers: [
		StatusBar,
		SplashScreen,
			{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
		Idle,
		Geolocation,
		Keyboard,
		Network,
		Printer,
		NavigationBar,
		NativePlatform,
		BusyBox,
		AlertError,
		Auth,
		AppCache,
		Scanner1,
		AppVersion,
		BackgroundMode,
		PowerManagement,
		TestService,
		AuthPrincipalTest,
		SqsTest,
		LoggingTest,
		PhysInvCountsProvider,
		InvMovesProvider,
		DbProductsProvider,
		LocatorInfoProvider,
		ToastProvider,
		Scanner,
		S3
	],
	bootstrap: [AppComponent]
})
export class AppModule {}
