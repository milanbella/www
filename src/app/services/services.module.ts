import { NgModule } from '@angular/core';
import { ModuleWithProviders } from '@angular/core';

@NgModule({
	declarations: [
	],
	imports: [
	],
	exports: [
	]
})
export class ServicesModule {
	static forRoot(): ModuleWithProviders {
		return {
			ngModule: ServicesModule,
			providers: [  ]
		};
	}
}
