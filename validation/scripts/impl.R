.libPaths(c("~/Rlib",.libPaths())); suppressMessages(library(traumar))
d<-read.csv("impl.csv"); p<-traumar::probability_of_survival(d$type,d$age,d$rts,d$iss)
cat(sprintf('{"traumar_version":"%s","n":%d,"max_abs_diff_pedsRule_off":%.3g,"max_abs_diff_pedsRule_on":%.3g,"n_diff_gt_1e-9_pedsRule_on":%d}\n',packageVersion("traumar"),nrow(d),max(abs(p-d$ps_core)),max(abs(p-d$ps_core_peds)),sum(abs(p-d$ps_core_peds)>1e-9)))
