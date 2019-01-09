import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
	{
		path: 'login',		
		loadChildren: './login/login.module#LoginPageModule'
	},
	{
		path: 'apps',
		loadChildren: './applications/applications.module#ApplicationsPageModule',		
	},
	// {                                                                                                                                                                          
	// 	path: '',                                                                                                                                                                
	// 	redirectTo: '/login',
	// 	pathMatch: 'full'                                                                                                                                                        
	// },
	{                                                                                                                                                                          
		path: '**',                                                                                                                                                                
		redirectTo: '/login',
		pathMatch: 'full'                                                                                                                                                        
	}  

];
@NgModule({
	imports: [RouterModule.forRoot(routes, {enableTracing: false})],
	exports: [RouterModule]
})
export class AppRoutingModule {}
