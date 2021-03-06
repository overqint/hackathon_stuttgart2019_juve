import { Module, OnModuleInit } from '@nestjs/common';
import { DeviceInfoController } from './device-info.controller';
import { AppService } from './app.service';
import { WalletProviderService } from './hyperledger/wallet-provider.service';
import { GatewayProviderService } from './hyperledger/gateway-provider.service';
import { BluetoothScannerService } from './bluetooth/bluetooth-scanner.service';
import { MockBluetoothScannerService } from './bluetooth/mock-bluetooth-scanner.service';
import { TripCorrelatorService } from './trip/trip-correlator.service';
import { TripStatusService } from './trip/trip-status.service';
import { MacHasherService } from './trip/mac-hasher.service';
import { debounceTime, map } from 'rxjs/operators'
import { merge } from 'rxjs';
import { MockController } from './mock.controller';
import { DemoController } from './demo.controller';
import { TripCommitService } from './trip/trip-commit.service';
import { TripStatusController } from './trip/trip-status.controller';
import { WebsocketService } from './trip/websocket.service';
import { FailsafeService } from './shared/failsafe.service';
import { MOCK_BLUETOOTH } from './shared/consts';
import { BaseBluetoothScannerService } from './bluetooth/base-bluetooth-scanner.service';

@Module({
  imports: [],
  controllers: [DeviceInfoController, MockController, DemoController, TripStatusController, TripStatusController],
  providers: [AppService, WalletProviderService, MockBluetoothScannerService, GatewayProviderService, BluetoothScannerService, TripCorrelatorService, TripCommitService, TripStatusService, MacHasherService, WebsocketService, FailsafeService],
})
export class AppModule implements OnModuleInit {

  constructor(
    private _bluetoothScannerService: BluetoothScannerService,
    private _mockBluetoothScannerService: MockBluetoothScannerService,
    private _tripCorrelatorService: TripCorrelatorService,
    private _tripStatusService: TripStatusService,
    private _macHasherService: MacHasherService
  ) { }


  private mapDevice(device: any) {
    return {
      ...device,
      mac: this._macHasherService.hashMac(device.mac)
    };
  }

  public onModuleInit() {
    const scannerServices: BaseBluetoothScannerService[] = [
      !MOCK_BLUETOOTH ? this._bluetoothScannerService : null,
      MOCK_BLUETOOTH ? this._mockBluetoothScannerService : null,
    ].filter((e) => !!e);
    let timeSlices = [];
    const foundDevices$ =
      merge(...scannerServices.map((e) => e.foundDevices$))
        .pipe(
          debounceTime(100),
          map((devices: any[]) => devices.map((device: any) => this.mapDevice(device)))
        );
    foundDevices$
      .subscribe((newTimeSlice) => {
        timeSlices.push(newTimeSlice);
        this._tripCorrelatorService.correlateTripInformation(timeSlices);
      });
    this._tripStatusService.initialize(foundDevices$);
    for (let scannerService of scannerServices) scannerService.start();
  }


}
