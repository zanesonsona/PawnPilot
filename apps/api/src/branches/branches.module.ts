import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { BranchesController } from "./branches.controller.js";
import { BranchesService } from "./branches.service.js";

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
